import { JWT } from "google-auth-library";

// Keep a cached access token and expiration to optimize calls
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Creates an authorized JWT client for Google Service Account.
 */
function getGoogleAuthClient() {
  const rawEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  
  if (!rawEmail || !rawKey) {
    return null;
  }

  // Clean email of wrapping quotes and whitespace
  let email = rawEmail.trim();
  if (email.startsWith('"') && email.endsWith('"')) {
    email = email.slice(1, -1);
  } else if (email.startsWith("'") && email.endsWith("'")) {
    email = email.slice(1, -1);
  }
  email = email.trim();

  // Clean private key of wrapping quotes and whitespace
  let key = rawKey.trim();
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  } else if (key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1);
  }
  key = key.trim().replace(/\\\\n/g, "\n").replace(/\\n/g, "\n");

  return new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

let spreadsheetIdOverride: string | null = null;

export function setSpreadsheetIdOverride(id: string | null) {
  spreadsheetIdOverride = id;
}

export function getSpreadsheetId(): string | null {
  const rawId = spreadsheetIdOverride || process.env.GOOGLE_SPREADSHEET_ID || null;
  if (!rawId) return null;
  
  let id = rawId.trim().replace(/^["']|["']$/g, "").trim();
  
  // If the user pasted a full Google Sheets URL, extract the spreadsheet ID
  // e.g. https://docs.google.com/spreadsheets/d/1GG9zmUmTY-doPNd-zPizy3kRaazyG6WOmBEG2ReFT1Y/edit#gid=0
  if (id.includes("/spreadsheets/d/")) {
    const parts = id.split("/spreadsheets/d/");
    if (parts[1]) {
      id = parts[1].split("/")[0];
    }
  } else if (id.includes("/d/")) {
    const parts = id.split("/d/");
    if (parts[1]) {
      id = parts[1].split("/")[0];
    }
  }
  
  // Clean up any remaining trailing query parameters or fragments
  id = id.split(/[?#]/)[0];
  
  return id.trim();
}

/**
 * Checks if Google Sheets credentials and Spreadsheet ID are configured.
 */
export function isGoogleSheetsConfigured(): boolean {
  const rawEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = getSpreadsheetId();

  if (!rawEmail || !rawKey || !sheetId) return false;

  const clean = (val: string) => {
    let s = val.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      s = s.slice(1, -1);
    } else if (s.startsWith("'") && s.endsWith("'")) {
      s = s.slice(1, -1);
    }
    return s.trim();
  };

  const email = clean(rawEmail);
  const key = clean(rawKey);

  if (!email || !key) return false;

  // Check for common placeholders
  const isPlaceholder = (val: string) => {
    const v = val.toUpperCase().trim();
    return (
      v === "" ||
      v.includes("YOUR_") ||
      v.includes("<YOUR") ||
      v.includes("INSERT_") ||
      v.includes("PLACEHOLDER")
    );
  };

  if (isPlaceholder(email) || isPlaceholder(key) || isPlaceholder(sheetId)) {
    return false;
  }

  return true;
}

/**
 * Retrieves a valid access token for Google API calls, caching it if possible.
 */
async function getAccessToken(): Promise<string> {
  const client = getGoogleAuthClient();
  if (!client) {
    throw new Error("Google Sheets API is not configured. Please define GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.");
  }

  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const tokenInfo = await client.authorize();
  if (!tokenInfo.access_token) {
    throw new Error("Failed to retrieve Google Sheets OAuth access token.");
  }

  cachedToken = tokenInfo.access_token;
  tokenExpiresAt = tokenInfo.expiry_date || (now + 3600000);
  return cachedToken;
}

/**
 * Generic helper to fetch Google Sheets API.
 */
async function callGoogleAPI(path: string, options: any = {}) {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error("Google Spreadsheet ID is not configured.");
  }

  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    let message = errorBody.error?.message || `Google API error: ${response.statusText} (${response.status})`;
    
    if (response.status === 404) {
      const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "your service account email";
      message = `Spreadsheet Not Found (404 Not Found). Please verify: 1) The Spreadsheet ID "${spreadsheetId}" is correct. 2) You have shared the Google Sheet with the Service Account email: "${saEmail}" and granted it 'Editor' permissions.`;
    } else if (response.status === 403) {
      const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "your service account email";
      message = `Access Denied (403 Forbidden). Please click 'Share' inside your Google Spreadsheet and grant Editor permissions to this service account: ${saEmail}`;
    } else if (response.status === 401) {
      message = `Authentication Failed (401 Unauthorized). Please check that your GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY secrets are correct.`;
    }
    
    throw new Error(message);
  }

  return response.json();
}

/**
 * Gets sheet metadata (sheets titles and IDs).
 */
export async function getSpreadsheetMetadata() {
  const data = await callGoogleAPI("");
  return data.sheets.map((s: any) => ({
    sheetId: s.properties.sheetId,
    title: s.properties.title,
    index: s.properties.index
  }));
}

/**
 * Executes a batch update request on the spreadsheet.
 */
async function batchUpdateSpreadsheet(requests: any[]) {
  return callGoogleAPI(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({ requests })
  });
}

/**
 * Writes or updates multiple ranges of values at once.
 */
async function batchWriteValues(data: { range: string; values: any[][] }[]) {
  return callGoogleAPI("/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data
    })
  });
}

/**
 * Clears values in a sheet range.
 */
async function clearValues(range: string) {
  return callGoogleAPI(`/values/${encodeURIComponent(range)}:clear`, {
    method: "POST"
  });
}

/**
 * Fetches sheet values from any spreadsheet ID and range using the service account credentials.
 */
export async function getSheetValues(spreadsheetId: string, range: string) {
  const token = await getAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    let message = errorBody.error?.message || `Google API error: ${response.statusText} (${response.status})`;
    
    if (response.status === 404) {
      const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "your service account email";
      message = `Spreadsheet Not Found (404 Not Found). Please verify: 1) The Spreadsheet ID "${spreadsheetId}" is correct. 2) You have shared the Google Sheet with the Service Account email: "${saEmail}" and granted it 'Editor' permissions.`;
    } else if (response.status === 403) {
      const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "your service account email";
      message = `Access Denied (403 Forbidden). Please click 'Share' inside your Google Spreadsheet and grant Editor permissions to this service account: ${saEmail}`;
    } else if (response.status === 401) {
      message = `Authentication Failed (401 Unauthorized). Please check that your GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY secrets are correct.`;
    }
    
    throw new Error(message);
  }

  return response.json();
}

/**
 * Appends a row of values to a sheet.
 */
export async function appendRowToSheet(sheetName: string, rowValues: any[]) {
  return callGoogleAPI(`/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({
      values: [rowValues]
    })
  });
}

/**
 * Overwrites a row at a specific index.
 */
export async function writeRowToSheet(sheetName: string, rowIndex: number, rowValues: any[]) {
  // e.g. Sheet1!A5:Z5
  const range = `${sheetName}!A${rowIndex}:Z${rowIndex}`;
  return callGoogleAPI(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({
      values: [rowValues]
    })
  });
}

/**
 * Fetches all tabs in batch.
 */
export async function batchGetRanges(ranges: string[]) {
  if (ranges.length === 0) return [];
  const query = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join("&");
  const data = await callGoogleAPI(`/values:batchGet?${query}`);
  return data.valueRanges || [];
}

/**
 * Bootstraps the spreadsheet with the default tables and schemas.
 */
export async function bootstrapSpreadsheet(defaultDb: any) {
  console.log("Bootstrapping Google Sheets database...");
  const metadata = await getSpreadsheetMetadata();
  const existingTitles = new Set(metadata.map((m: any) => m.title));

  const sheetsToCreate = [];

  // Create _tables_config if missing
  if (!existingTitles.has("_tables_config")) {
    sheetsToCreate.push({ addSheet: { properties: { title: "_tables_config" } } });
  }

  // Create _users if missing
  if (!existingTitles.has("_users")) {
    sheetsToCreate.push({ addSheet: { properties: { title: "_users" } } });
  }

  // Create _settings if missing
  if (!existingTitles.has("_settings")) {
    sheetsToCreate.push({ addSheet: { properties: { title: "_settings" } } });
  }

  // Create default data sheets
  for (const tableKey of Object.keys(defaultDb.tables)) {
    if (!existingTitles.has(tableKey)) {
      sheetsToCreate.push({ addSheet: { properties: { title: tableKey } } });
    }
  }

  if (sheetsToCreate.length > 0) {
    await batchUpdateSpreadsheet(sheetsToCreate);
  }

  // Prepare batch values to write
  const writePayload: { range: string; values: any[][] }[] = [];

  // Write _tables_config rows if empty or missing
  const currentMetadata = await getSpreadsheetMetadata();
  const rangesToFetch = ["_tables_config!A1:E2", "_users!A1:G2", "_settings!A1:C10"];
  const valRanges = await batchGetRanges(rangesToFetch);
  
  const tablesConfigVal = valRanges.find((r: any) => r.range.startsWith("_tables_config"));
  const usersVal = valRanges.find((r: any) => r.range.startsWith("_users"));
  const settingsVal = valRanges.find((r: any) => r.range.startsWith("_settings"));

  if (!tablesConfigVal || !tablesConfigVal.values || tablesConfigVal.values.length === 0) {
    const headers = ["tableKey", "displayName", "description", "icon", "columnsJson"];
    const rows = [headers];
    
    Object.entries(defaultDb.tables).forEach(([key, t]: [string, any]) => {
      rows.push([
        key,
        t.displayName,
        t.description,
        t.icon,
        JSON.stringify(t.columns)
      ]);
    });
    
    writePayload.push({ range: "_tables_config!A1", values: rows });
  }

  // Write _users if empty or missing
  if (!usersVal || !usersVal.values || usersVal.values.length === 0) {
    const headers = ["id", "username", "passwordHash", "role", "fullName", "email", "avatar"];
    const rows = [headers];

    defaultDb.users.forEach((u: any) => {
      rows.push([
        u.id,
        u.username,
        u.passwordHash,
        u.role,
        u.fullName,
        u.email,
        u.avatar
      ]);
    });

    writePayload.push({ range: "_users!A1", values: rows });
  }

  // Write _settings if empty or missing
  if (!settingsVal || !settingsVal.values || settingsVal.values.length === 0) {
    const headers = ["key", "value", "description"];
    const rows = [
      headers,
      ["websiteTitle", defaultDb.settings?.websiteTitle || "MCA Recording Portal", "Website Title used in browser tabs and titles"],
      ["logoText", defaultDb.settings?.logoText || "MCA Recorder", "Text displaying next to the logo"],
      ["faviconTitle", defaultDb.settings?.faviconTitle || "MCA Records", "The website title displayed in favicon"],
      ["faviconLogoUrl", defaultDb.settings?.faviconLogoUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128", "Favoricon logo image URL"],
      ["logoUrl", defaultDb.settings?.logoUrl || "", "Custom Logo URL"]
    ];

    writePayload.push({ range: "_settings!A1", values: rows });
  }

  // Write default tables rows if they are empty
  for (const tableKey of Object.keys(defaultDb.tables)) {
    const tVal = valRanges.find((r: any) => r.range.startsWith(tableKey)) || 
                 (await batchGetRanges([`${tableKey}!A1:B2`]))[0];

    if (!tVal || !tVal.values || tVal.values.length === 0) {
      const tableDef = defaultDb.tables[tableKey];
      const colKeys = tableDef.columns.map((c: any) => c.key);
      const rows = [colKeys];

      tableDef.rows.forEach((row: any) => {
        rows.push(colKeys.map((k: string) => row[k] !== undefined ? row[k] : ""));
      });

      writePayload.push({ range: `${tableKey}!A1`, values: rows });
    }
  }

  if (writePayload.length > 0) {
    await batchWriteValues(writePayload);
  }

  console.log("Google Sheets database bootstrapped successfully!");
}

/**
 * Loads the entire database from Google Sheets.
 */
export async function loadDatabaseFromSheets(defaultDb: any): Promise<any> {
  try {
    const metadata = await getSpreadsheetMetadata();
    const existingTitles = new Set(metadata.map((m: any) => m.title));

    // If _tables_config is missing or empty, bootstrap everything first
    if (!existingTitles.has("_tables_config") || !existingTitles.has("_users") || !existingTitles.has("_settings")) {
      await bootstrapSpreadsheet(defaultDb);
    }

    // List of sheets to fetch
    const sheetsList = await getSpreadsheetMetadata();
    const titles = sheetsList.map((s: any) => s.title);
    
    // Batch fetch all sheet data
    const batchData = await batchGetRanges(titles.map(t => `${t}!A1:Z5000`));

    // Map of sheet title -> rows arrays
    const sheetDataMap: { [title: string]: any[][] } = {};
    batchData.forEach((valRange: any) => {
      // Parse range title (e.g. "'inventory'!A1:Z5000" or "inventory!A1:Z5000")
      const match = valRange.range.match(/^'?([^'!]+)'?!/);
      if (match) {
        sheetDataMap[match[1]] = valRange.values || [];
      }
    });

    // Parse Users
    const usersRaw = sheetDataMap["_users"] || [];
    let users = [];
    if (usersRaw.length > 1) {
      const headers = usersRaw[0];
      users = usersRaw.slice(1).map((rowVal: any[]) => {
        const uObj: any = {};
        headers.forEach((h: string, idx: number) => {
          uObj[h] = rowVal[idx] !== undefined ? rowVal[idx] : "";
        });
        return uObj;
      });
    } else {
      users = defaultDb.users;
    }

    // Parse Settings
    const settingsRaw = sheetDataMap["_settings"] || [];
    const settings: any = { ...defaultDb.settings };
    if (settingsRaw.length > 1) {
      settingsRaw.slice(1).forEach((rowVal: any[]) => {
        const key = rowVal[0];
        const value = rowVal[1];
        if (key) {
          settings[key] = value !== undefined ? value : "";
        }
      });
    }

    // Parse registered table definitions from _tables_config
    const tablesConfigRaw = sheetDataMap["_tables_config"] || [];
    const registeredTables: { [key: string]: any } = {};

    if (tablesConfigRaw.length > 1) {
      const headers = tablesConfigRaw[0];
      tablesConfigRaw.slice(1).forEach((rowVal: any[]) => {
        const item: any = {};
        headers.forEach((h: string, idx: number) => {
          item[h] = rowVal[idx] !== undefined ? rowVal[idx] : "";
        });

        if (item.tableKey) {
          try {
            registeredTables[item.tableKey] = {
              displayName: item.displayName || item.tableKey,
              description: item.description || "",
              icon: item.icon || "Database",
              columns: JSON.parse(item.columnsJson || "[]"),
              rows: []
            };
          } catch {
            // Fallback for json parse error
            registeredTables[item.tableKey] = {
              displayName: item.displayName || item.tableKey,
              description: item.description || "",
              icon: item.icon || "Database",
              columns: [],
              rows: []
            };
          }
        }
      });
    }

    // Process all other tabs as data tables
    const dbTables: { [key: string]: any } = {};

    for (const title of titles) {
      // Skip system sheets
      if (title.startsWith("_")) continue;

      const rawValues = sheetDataMap[title] || [];
      if (rawValues.length === 0) continue;

      const headers = rawValues[0];
      
      // If not registered, create schema dynamically
      if (!registeredTables[title]) {
        const seenKeys = new Set<string>();
        const columns = headers.map((header: string, index: number) => {
          let key = String(header).toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/^_+|_+$/g, "") || `column_${index}`;
          if (seenKeys.has(key)) key = `${key}_${index}`;
          seenKeys.add(key);
          return {
            key,
            label: String(header) || `Column ${index + 1}`,
            type: "string",
            required: false
          };
        });

        registeredTables[title] = {
          displayName: title.charAt(0).toUpperCase() + title.slice(1),
          description: `Discovered Sheet from Google Spreadsheet`,
          icon: "Database",
          columns,
          rows: []
        };

        // Save new sheet schema registration back to _tables_config
        await appendRowToSheet("_tables_config", [
          title,
          registeredTables[title].displayName,
          registeredTables[title].description,
          registeredTables[title].icon,
          JSON.stringify(columns)
        ]);
      }

      const tableSchema = registeredTables[title];
      const colKeys = tableSchema.columns.map((c: any) => c.key);

      // Parse data rows
      const rows = rawValues.slice(1).map((rowVal: any[], rowIndex: number) => {
        const rowObj: any = {};
        
        // Ensure id is present
        const idColIndex = headers.findIndex((h: string) => h.toLowerCase() === "id");
        if (idColIndex !== -1 && rowVal[idColIndex]) {
          rowObj.id = String(rowVal[idColIndex]);
        } else {
          rowObj.id = `${title.substring(0,3)}-${String(rowIndex + 1).padStart(3, "0")}`;
        }

        tableSchema.columns.forEach((col: any) => {
          const colIndex = headers.findIndex((h: string) => h.toLowerCase() === col.key.toLowerCase());
          if (colIndex !== -1) {
            const val = rowVal[colIndex];
            if (val === undefined || val === null || String(val).trim() === "") {
              rowObj[col.key] = col.type === "number" ? 0 : "";
            } else {
              if (col.type === "number") {
                const num = Number(val);
                rowObj[col.key] = isNaN(num) ? String(val) : num;
              } else {
                rowObj[col.key] = String(val);
              }
            }
          } else {
            if (col.key !== "id") {
              rowObj[col.key] = col.type === "number" ? 0 : "";
            }
          }
        });

        return rowObj;
      });

      dbTables[title] = {
        ...tableSchema,
        rows
      };
    }

    return {
      users,
      tables: dbTables,
      settings
    };
  } catch (err: any) {
    console.log("[Google Sheets Connection] Info: Active sync is currently pending setup or offline. Local cache used:", err.message);
    throw err;
  }
}

/**
 * Handles creating a brand-new table sheet.
 */
export async function createGoogleSheetTable(tableKey: string, displayName: string, description: string, icon: string, columns: any[]) {
  const metadata = await getSpreadsheetMetadata();
  const existingTitles = new Set(metadata.map((m: any) => m.title));

  // 1. Create tab if not exists
  if (!existingTitles.has(tableKey)) {
    await batchUpdateSpreadsheet([
      { addSheet: { properties: { title: tableKey } } }
    ]);
  }

  // 2. Write headers row
  const colKeys = columns.map(c => c.key);
  await batchWriteValues([
    { range: `${tableKey}!A1`, values: [colKeys] }
  ]);

  // 3. Save config inside _tables_config
  // Find if already registered
  const tablesConfigVal = await batchGetRanges(["_tables_config!A1:A500"]);
  const rows = tablesConfigVal[0]?.values || [];
  const rowIndex = rows.findIndex((r: any[]) => r[0] === tableKey);

  const rowValues = [
    tableKey,
    displayName,
    description,
    icon,
    JSON.stringify(columns)
  ];

  if (rowIndex !== -1) {
    await writeRowToSheet("_tables_config", rowIndex + 1, rowValues);
  } else {
    await appendRowToSheet("_tables_config", rowValues);
  }
}

/**
 * Inserts a new row to a data tab in Google Sheets.
 */
export async function insertRowToSheets(tableKey: string, rowObj: any, columns: any[]) {
  const colKeys = columns.map(c => c.key);
  const rowValues = colKeys.map(k => rowObj[k] !== undefined ? rowObj[k] : "");
  await appendRowToSheet(tableKey, rowValues);
}

/**
 * Updates a row in Google Sheets by searching for its ID.
 */
export async function updateRowInSheets(tableKey: string, id: string, updatedRowObj: any, columns: any[]) {
  // 1. Fetch values
  const dataVal = await batchGetRanges([`${tableKey}!A1:Z5000`]);
  const rows = dataVal[0]?.values || [];
  if (rows.length === 0) throw new Error(`Table ${tableKey} has no rows.`);

  const headers = rows[0];
  const idColIndex = headers.findIndex((h: string) => h.toLowerCase() === "id");
  if (idColIndex === -1) throw new Error(`ID column missing in sheet ${tableKey}`);

  // Find matching row index
  const rowIndex = rows.findIndex((r: any[], idx: number) => idx > 0 && String(r[idColIndex]) === id);
  if (rowIndex === -1) throw new Error(`Row with ID ${id} not found in ${tableKey}`);

  // 2. Map row object into the correct column positions
  const colKeys = columns.map(c => c.key);
  const newValues = colKeys.map(k => updatedRowObj[k] !== undefined ? updatedRowObj[k] : "");

  await writeRowToSheet(tableKey, rowIndex + 1, newValues);
}

/**
 * Deletes a row in Google Sheets by row index.
 */
export async function deleteRowInSheets(tableKey: string, id: string) {
  // 1. Fetch spreadsheet metadata to get sheetId
  const metadata = await getSpreadsheetMetadata();
  const sheetMeta = metadata.find((m: any) => m.title === tableKey);
  if (!sheetMeta) throw new Error(`Sheet ${tableKey} not found.`);

  // 2. Fetch all values to find the matching row index
  const dataVal = await batchGetRanges([`${tableKey}!A1:Z5000`]);
  const rows = dataVal[0]?.values || [];
  if (rows.length === 0) return;

  const headers = rows[0];
  const idColIndex = headers.findIndex((h: string) => h.toLowerCase() === "id");
  if (idColIndex === -1) throw new Error(`ID column missing in sheet ${tableKey}`);

  const rowIndex = rows.findIndex((r: any[], idx: number) => idx > 0 && String(r[idColIndex]) === id);
  if (rowIndex === -1) throw new Error(`Row with ID ${id} not found in ${tableKey}`);

  // 3. Trigger delete request
  await batchUpdateSpreadsheet([
    {
      deleteDimension: {
        range: {
          sheetId: sheetMeta.sheetId,
          dimension: "ROWS",
          startIndex: rowIndex, // 0-based index of start
          endIndex: rowIndex + 1
        }
      }
    }
  ]);
}

/**
 * Saves core branding settings back to Google Sheets.
 */
export async function saveSettingsToSheets(settings: any) {
  const headers = ["key", "value", "description"];
  const rows = [
    headers,
    ["websiteTitle", settings.websiteTitle || "MCA Recording Portal", "Website Title used in browser tabs and titles"],
    ["logoText", settings.logoText || "MCA Recorder", "Text displaying next to the logo"],
    ["faviconTitle", settings.faviconTitle || "MCA Records", "The website title displayed in favicon"],
    ["faviconLogoUrl", settings.faviconLogoUrl || "", "Favoricon logo image URL"],
    ["logoUrl", settings.logoUrl || "", "Custom Logo URL"]
  ];
  
  await batchWriteValues([
    { range: "_settings!A1", values: rows }
  ]);
}

/**
 * Inserts a new user / administrator into Google Sheets.
 */
export async function insertUserToSheets(userObj: any) {
  const rowValues = [
    userObj.id,
    userObj.username,
    userObj.passwordHash,
    userObj.role || "Administrator",
    userObj.fullName,
    userObj.email || "",
    userObj.avatar || "👤"
  ];
  await appendRowToSheet("_users", rowValues);
}
