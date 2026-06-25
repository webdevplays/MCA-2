import express from "express";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import {
  isGoogleSheetsConfigured,
  loadDatabaseFromSheets,
  createGoogleSheetTable,
  insertRowToSheets,
  updateRowInSheets,
  deleteRowInSheets,
  getSheetValues,
  saveSettingsToSheets,
  insertUserToSheets,
  setSpreadsheetIdOverride,
  getSpreadsheetId
} from "./googleSheets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DB_FILE_PATH = path.join(process.cwd(), "database.json");

let lastGoogleSheetsError: string | null = null;

// Default initial database content
const DEFAULT_DATABASE = {
  users: [
    {
      id: "usr-1",
      username: "admin",
      passwordHash: "admin123",
      role: "Administrator",
      fullName: "System Admin",
      email: "admin@mcarecordings.com",
      avatar: "🛡️"
    }
  ],
  tables: {
    mca_records: {
      displayName: "MCA Recorded",
      description: "Stored MCA Records database for PINs, Names, and Addresses.",
      icon: "FileSpreadsheet",
      columns: [
        { key: "id", label: "ID", type: "string", readonly: true },
        { key: "pin", label: "PIN", type: "string", required: true },
        { key: "fullName", label: "Full Name", type: "string", required: true },
        { key: "address", label: "Address", type: "string", required: false },
        { key: "createdAt", label: "Created At", type: "date", readonly: true }
      ],
      rows: [
        { id: "mca-001", pin: "123456789012", fullName: "John Doe", address: "123 Main St, New York, NY", createdAt: "2026-06-24" },
        { id: "mca-002", pin: "987654321098", fullName: "Jane Smith", address: "", createdAt: "2026-06-24" }
      ]
    }
  },
  settings: {
    websiteTitle: "MCA Recording Portal",
    logoText: "MCA Recorder",
    faviconTitle: "MCA Records",
    faviconLogoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128",
    logoUrl: ""
  }
};

// Database read/write helpers
async function initDatabase() {
  try {
    await fs.access(DB_FILE_PATH);
  } catch {
    // Write default database if file doesn't exist
    await fs.writeFile(DB_FILE_PATH, JSON.stringify(DEFAULT_DATABASE, null, 2), "utf-8");
  }
}

async function getDatabase() {
  // Try to load any local spreadsheet ID override from local file
  let localCustomSpreadsheetId: string | null = null;
  try {
    await initDatabase();
    const content = await fs.readFile(DB_FILE_PATH, "utf-8");
    const localDb = JSON.parse(content);
    if (localDb?.settings?.customSpreadsheetId) {
      localCustomSpreadsheetId = localDb.settings.customSpreadsheetId;
    }
  } catch (e) {
    // Ignore error and fall back
  }

  // Set the override in googleSheets module
  setSpreadsheetIdOverride(localCustomSpreadsheetId);

  if (isGoogleSheetsConfigured()) {
    try {
      const db = await loadDatabaseFromSheets(DEFAULT_DATABASE);
      lastGoogleSheetsError = null;
      return db;
    } catch (err: any) {
      lastGoogleSheetsError = err.message;
      console.log("[Database Integration] Notice: Using local cache storage as fallback:", err.message);
    }
  } else {
    lastGoogleSheetsError = "Google Sheets credentials or Spreadsheet ID not configured in environment secrets.";
  }
  await initDatabase();
  const content = await fs.readFile(DB_FILE_PATH, "utf-8");
  return JSON.parse(content);
}

async function saveDatabase(data: any) {
  // Always write a local JSON copy as cache/backup
  await fs.writeFile(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function createExpressApp(includeStaticAndVite = true) {
  const app = express();
  app.use(express.json());

  // Initialize DB immediately on boot
  await initDatabase();

  // Helper auth check middleware
  const getAuthenticatedUser = async (req: express.Request) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    
    const token = authHeader.substring(7);
    const db = await getDatabase();
    
    // Find user with matching token (our token is simply "token-[username]")
    if (token.startsWith("token-")) {
      const username = token.substring(6);
      return db.users.find((u: any) => u.username === username) || null;
    }
    return null;
  };

  // 1. AUTHENTICATION ENDPOINTS
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    try {
      const db = await getDatabase();
      const user = db.users.find(
        (u: any) => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === password
      );

      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Generate simple, robust token safe for iframe environments
      const token = `token-${user.username}`;
      
      const { passwordHash, ...userResponse } = user;
      res.json({
        user: userResponse,
        token
      });
    } catch (err: any) {
      res.status(500).json({ error: "Database error: " + err.message });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const { passwordHash, ...userResponse } = user;
      res.json({ user: userResponse });
    } catch (err: any) {
      res.status(500).json({ error: "Authentication check failed: " + err.message });
    }
  });

  // 2. DATABASE MANAGEMENT ENDPOINTS
  app.get("/api/db/tables", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: "Access denied: Unauthorized" });
      }

      const db = await getDatabase();
      const tablesMetadata = Object.keys(db.tables).reduce((acc: any, key) => {
        const t = db.tables[key];
        acc[key] = {
          key,
          displayName: t.displayName,
          description: t.description,
          icon: t.icon,
          columns: t.columns,
          rowCount: t.rows.length
        };
        return acc;
      }, {});

      res.json({ 
        tables: tablesMetadata,
        isGoogleSheetsActive: isGoogleSheetsConfigured() && !lastGoogleSheetsError,
        googleSheetsError: lastGoogleSheetsError,
        serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
        spreadsheetId: getSpreadsheetId() || ""
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch tables: " + err.message });
    }
  });

  // 2.3 CUSTOM SETTINGS AND ADMIN ENDPOINTS
  app.get("/api/settings", async (req, res) => {
    try {
      const db = await getDatabase();
      const settings = db.settings || DEFAULT_DATABASE.settings;
      res.json({
        settings,
        isGoogleSheetsActive: isGoogleSheetsConfigured() && !lastGoogleSheetsError,
        googleSheetsError: lastGoogleSheetsError,
        serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
        spreadsheetId: getSpreadsheetId() || ""
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch settings: " + err.message });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user || user.role !== "Administrator") {
        return res.status(403).json({ error: "Access denied. Only Administrators can update settings." });
      }
      
      const updatedSettings = req.body;
      if (!updatedSettings) {
        return res.status(400).json({ error: "Settings payload is missing" });
      }

      const db = await getDatabase();
      const oldSpreadsheetId = db.settings?.customSpreadsheetId || "";
      const newSpreadsheetId = updatedSettings.customSpreadsheetId !== undefined ? updatedSettings.customSpreadsheetId : db.settings?.customSpreadsheetId || "";

      db.settings = {
        websiteTitle: updatedSettings.websiteTitle || db.settings?.websiteTitle || "MCA Recording Portal",
        logoText: updatedSettings.logoText || db.settings?.logoText || "MCA Recorder",
        faviconTitle: updatedSettings.faviconTitle || db.settings?.faviconTitle || "MCA Records",
        faviconLogoUrl: updatedSettings.faviconLogoUrl || db.settings?.faviconLogoUrl || "",
        logoUrl: updatedSettings.logoUrl !== undefined ? updatedSettings.logoUrl : db.settings?.logoUrl || "",
        customSpreadsheetId: newSpreadsheetId
      };

      // Set the override immediately so isGoogleSheetsConfigured() uses the new one
      setSpreadsheetIdOverride(newSpreadsheetId || null);

      if (isGoogleSheetsConfigured()) {
        try {
          // If the spreadsheet ID changed, or if there was a previous error, try to validate immediately
          if (newSpreadsheetId !== oldSpreadsheetId || lastGoogleSheetsError) {
            const sheetsDb = await loadDatabaseFromSheets(DEFAULT_DATABASE);
            // Sync success! Load the sheets database content
            db.tables = sheetsDb.tables;
            db.users = sheetsDb.users;
            db.settings = { ...sheetsDb.settings, customSpreadsheetId: newSpreadsheetId };
          } else {
            await saveSettingsToSheets(db.settings);
          }
          lastGoogleSheetsError = null;
        } catch (sheetErr: any) {
          lastGoogleSheetsError = sheetErr.message;
          console.log("[Google Sheets] Notice: Local settings saved, sheet sync is offline:", sheetErr.message);
        }
      }

      await saveDatabase(db);
      res.json({ success: true, settings: db.settings });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to save settings: " + err.message });
    }
  });

  app.post("/api/admin/create", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user || user.role !== "Administrator") {
        return res.status(403).json({ error: "Access denied. Only Administrators can create new admin credentials." });
      }

      const { username, password, fullName, email } = req.body;
      if (!username || !password || !fullName) {
        return res.status(400).json({ error: "Username, password, and Full Name are required." });
      }

      const db = await getDatabase();
      
      const exists = db.users.some((u: any) => u.username.toLowerCase() === username.toLowerCase());
      if (exists) {
        return res.status(400).json({ error: "Username already exists." });
      }

      const newAdmin = {
        id: `usr-${Date.now()}`,
        username: username.trim(),
        passwordHash: password,
        role: "Administrator",
        fullName: fullName.trim(),
        email: email ? email.trim() : "",
        avatar: "🛡️"
      };

      db.users.push(newAdmin);

      if (isGoogleSheetsConfigured()) {
        try {
          await insertUserToSheets(newAdmin);
          lastGoogleSheetsError = null;
        } catch (sheetErr: any) {
          lastGoogleSheetsError = sheetErr.message;
          console.log("[Google Sheets] Notice: Local admin saved, sheet sync is offline:", sheetErr.message);
        }
      }

      await saveDatabase(db);
      res.json({ success: true, message: "New administrator credentials added successfully." });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to create administrator: " + err.message });
    }
  });

  app.get("/api/db/data/:table", async (req, res) => {
    const { table } = req.params;
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: "Access denied" });
      }

      const db = await getDatabase();
      const tableData = db.tables[table];
      if (!tableData) {
        return res.status(404).json({ error: `Table '${table}' not found` });
      }

      res.json({
        table: table,
        columns: tableData.columns,
        rows: tableData.rows
      });
    } catch (err: any) {
      res.status(500).json({ error: "Query failed: " + err.message });
    }
  });

  app.post("/api/db/data/:table", async (req, res) => {
    const { table } = req.params;
    const newRow = req.body;

    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: "Access denied" });
      }

      const db = await getDatabase();
      const tableData = db.tables[table];
      if (!tableData) {
        return res.status(404).json({ error: `Table '${table}' not found` });
      }

      // Generate appropriate next ID
      const prefix = table.substring(0, 3).toLowerCase();
      const existingIds = tableData.rows.map((r: any) => {
        const m = r.id.match(/\d+$/);
        return m ? parseInt(m[0], 10) : 0;
      });
      const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
      const newIdNum = String(maxId + 1).padStart(3, "0");
      const generatedId = `${prefix}-${newIdNum}`;

      const rowToInsert = {
        ...newRow,
        id: generatedId,
        updatedAt: new Date().toISOString().split("T")[0]
      };

      // Ensure standard keys exist
      tableData.columns.forEach((col: any) => {
        if (rowToInsert[col.key] === undefined && !col.readonly) {
          rowToInsert[col.key] = col.type === "number" ? 0 : "";
        }
      });

      tableData.rows.push(rowToInsert);
      if (isGoogleSheetsConfigured()) {
        try {
          await insertRowToSheets(table, rowToInsert, tableData.columns);
          lastGoogleSheetsError = null;
        } catch (sheetErr: any) {
          lastGoogleSheetsError = sheetErr.message;
          console.log("[Google Sheets] Notice: Local row saved, sheet sync is offline:", sheetErr.message);
        }
      }
      await saveDatabase(db);

      res.status(201).json({
        success: true,
        message: "Record created successfully",
        row: rowToInsert
      });
    } catch (err: any) {
      res.status(500).json({ error: "Insertion failed: " + err.message });
    }
  });

  app.put("/api/db/data/:table/:id", async (req, res) => {
    const { table, id } = req.params;
    const updatedFields = req.body;

    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: "Access denied" });
      }

      const db = await getDatabase();
      const tableData = db.tables[table];
      if (!tableData) {
        return res.status(404).json({ error: `Table '${table}' not found` });
      }

      const rowIndex = tableData.rows.findIndex((r: any) => r.id === id);
      if (rowIndex === -1) {
        return res.status(404).json({ error: `Record with ID '${id}' not found` });
      }

      // Update record preserving ID and injecting fresh updatedAt if table supports it
      const existingRow = tableData.rows[rowIndex];
      const mergedRow = {
        ...existingRow,
        ...updatedFields,
        id: existingRow.id // Guarantee key immutability
      };

      if (tableData.columns.some((c: any) => c.key === "updatedAt")) {
        mergedRow.updatedAt = new Date().toISOString().split("T")[0];
      }

      tableData.rows[rowIndex] = mergedRow;
      if (isGoogleSheetsConfigured()) {
        try {
          await updateRowInSheets(table, id, mergedRow, tableData.columns);
          lastGoogleSheetsError = null;
        } catch (sheetErr: any) {
          lastGoogleSheetsError = sheetErr.message;
          console.log("[Google Sheets] Notice: Local row updated, sheet sync is offline:", sheetErr.message);
        }
      }
      await saveDatabase(db);

      res.json({
        success: true,
        message: "Record updated successfully",
        row: mergedRow
      });
    } catch (err: any) {
      res.status(500).json({ error: "Update failed: " + err.message });
    }
  });

  app.delete("/api/db/data/:table/:id", async (req, res) => {
    const { table, id } = req.params;

    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: "Access denied" });
      }

      const db = await getDatabase();
      const tableData = db.tables[table];
      if (!tableData) {
        return res.status(404).json({ error: `Table '${table}' not found` });
      }

      const rowIndex = tableData.rows.findIndex((r: any) => r.id === id);
      if (rowIndex === -1) {
        return res.status(404).json({ error: `Record with ID '${id}' not found` });
      }

      tableData.rows.splice(rowIndex, 1);
      if (isGoogleSheetsConfigured()) {
        try {
          await deleteRowInSheets(table, id);
          lastGoogleSheetsError = null;
        } catch (sheetErr: any) {
          lastGoogleSheetsError = sheetErr.message;
          console.log("[Google Sheets] Notice: Local row deleted, sheet sync is offline:", sheetErr.message);
        }
      }
      await saveDatabase(db);

      res.json({
        success: true,
        message: `Record '${id}' successfully deleted`
      });
    } catch (err: any) {
      res.status(500).json({ error: "Deletion failed: " + err.message });
    }
  });

  // 2.5 GOOGLE SHEETS ENDPOINTS USING SERVICE ACCOUNT OAUTH
  app.post("/api/sheets/preview", async (req, res) => {
    const { spreadsheetId, range } = req.body;
    
    if (!isGoogleSheetsConfigured()) {
      return res.status(400).json({ 
        error: "Google Sheets Service Account credentials are not configured in the server environment variables (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY)." 
      });
    }

    if (!spreadsheetId || !range) {
      return res.status(400).json({ error: "Spreadsheet ID and Sheet Range are required." });
    }

    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: "Access denied" });
      }

      // Fetch values securely using Service Account JWT client
      const data = await getSheetValues(spreadsheetId, range);
      const values = data.values;
      if (!values || values.length === 0) {
        throw new Error("No records or rows found in the specified Sheet range.");
      }

      const headers = values[0];
      const seenKeys = new Set<string>();
      const columns = headers.map((header: string, index: number) => {
        let key = String(header).toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/^_+|_+$/g, "") || `column_${index}`;
        if (seenKeys.has(key)) {
          key = `${key}_${index}`;
        }
        seenKeys.add(key);
        return {
          key,
          label: String(header) || `Column ${index + 1}`,
          type: "string",
          required: false
        };
      });

      // Parse data rows and infer types
      const rows = values.slice(1).map((rowVal: any[], rowIndex: number) => {
        const rowObj: any = { id: `row-${rowIndex + 1}` };
        columns.forEach((col: any, colIndex: number) => {
          const val = rowVal[colIndex];
          if (val === undefined || val === null || String(val).trim() === "") {
            rowObj[col.key] = "";
          } else {
            const numVal = Number(val);
            if (!isNaN(numVal) && String(val).trim() !== "") {
              rowObj[col.key] = numVal;
              col.type = "number"; // Refine type to number dynamically
            } else {
              rowObj[col.key] = String(val);
            }
          }
        });
        return rowObj;
      });

      res.json({
        columns,
        rows,
        spreadsheetId,
        range,
        rowCount: rows.length
      });
    } catch (err: any) {
      res.status(500).json({ error: "Google Sheets load failed: " + err.message });
    }
  });

  app.post("/api/sheets/import", async (req, res) => {
    const { spreadsheetId, range, tableName, displayName, description } = req.body;

    if (!isGoogleSheetsConfigured()) {
      return res.status(400).json({ 
        error: "Google Sheets Service Account credentials are not configured in the server environment variables." 
      });
    }

    if (!spreadsheetId || !range || !tableName || !displayName) {
      return res.status(400).json({ error: "Missing required fields for collection creation." });
    }

    // Sanitize table name
    const sanitizedTableKey = tableName.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/^_+|_+$/g, "");

    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: "Access denied" });
      }

      // Fetch values securely using Service Account JWT client
      const data = await getSheetValues(spreadsheetId, range);
      const values = data.values;
      if (!values || values.length === 0) {
        throw new Error("No data found in the spreadsheet range.");
      }

      const headers = values[0];
      const seenKeys = new Set<string>();
      
      // Setup base columns (ensure we have an 'id' column as the first key)
      const columns: any[] = [
        { key: "id", label: "ID", type: "string", readonly: true }
      ];

      headers.forEach((header: string, index: number) => {
        let key = String(header).toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/^_+|_+$/g, "");
        if (!key) key = `col_${index}`;
        if (key === "id") return; // Skip if header is 'id' to prevent conflict
        
        if (seenKeys.has(key)) {
          key = `${key}_${index}`;
        }
        seenKeys.add(key);

        columns.push({
          key,
          label: String(header) || `Column ${index + 1}`,
          type: "string",
          required: false
        });
      });

      // Parse data rows
      const rows = values.slice(1).map((rowVal: any[], rowIndex: number) => {
        const prefix = sanitizedTableKey.substring(0, 3);
        const generatedId = `${prefix}-${String(rowIndex + 1).padStart(3, "0")}`;
        const rowObj: any = { id: generatedId };

        headers.forEach((header: string, index: number) => {
          let key = String(header).toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/^_+|_+$/g, "");
          if (!key) key = `col_${index}`;
          if (key === "id") return;

          const val = rowVal[index];
          if (val === undefined || val === null || String(val).trim() === "") {
            rowObj[key] = "";
          } else {
            const numVal = Number(val);
            if (!isNaN(numVal) && String(val).trim() !== "") {
              rowObj[key] = numVal;
              // Update the column definition type
              const colDef = columns.find(c => c.key === key);
              if (colDef) colDef.type = "number";
            } else {
              rowObj[key] = String(val);
            }
          }
        });

        // Also add updatedAt column if it is present in rows
        rowObj.updatedAt = new Date().toISOString().split("T")[0];
        return rowObj;
      });

      // Append 'updatedAt' column definition
      columns.push({
        key: "updatedAt",
        label: "Last Synced",
        type: "string",
        readonly: true
      });

      const db = await getDatabase();
      db.tables[sanitizedTableKey] = {
        displayName,
        description: description || `Synced collection from Google Sheet (${range})`,
        icon: "Database",
        columns,
        rows
      };

      if (isGoogleSheetsConfigured()) {
        try {
          await createGoogleSheetTable(sanitizedTableKey, displayName, description || `Synced collection from Google Sheet (${range})`, "Database", columns);
          for (const row of rows) {
            await insertRowToSheets(sanitizedTableKey, row, columns);
          }
        } catch (sheetErr: any) {
          console.log("[Google Sheets] Notice: Table imported locally, sheet sync is offline:", sheetErr.message);
        }
      }

      await saveDatabase(db);

      res.status(201).json({
        success: true,
        message: `Successfully imported table '${sanitizedTableKey}' with ${rows.length} rows.`,
        tableKey: sanitizedTableKey
      });
    } catch (err: any) {
      res.status(500).json({ error: "Import failed: " + err.message });
    }
  });

  // 3. VITE OR STATIC FILE HANDLER MIDDLEWARE
  if (includeStaticAndVite) {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  return app;
}

if (!process.env.NETLIFY) {
  createExpressApp(true).then((app) => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT} with active file database persistence`);
    });
  }).catch((err) => {
    console.error("Failed to start server:", err);
  });
}
