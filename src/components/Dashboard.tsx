import React, { useState, useEffect } from "react";
import { 
  Database, Plus, Search, Trash2, Edit, Download, RefreshCw, 
  LogOut, CheckCircle2, AlertCircle, X, ChevronRight, Shield, 
  Settings, Key, UserPlus, FileSpreadsheet, Building,
  Check, FileText, Globe, Image, Layout, Menu, Printer, Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, TableRows } from "../types";

interface DashboardProps {
  user: User;
  token: string;
  onLogout: () => void;
}

export default function Dashboard({ user, token, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<"record" | "list" | "settings">("record");
  const [rows, setRows] = useState<TableRows>([]);
  const [isGoogleSheetsActive, setIsGoogleSheetsActive] = useState(false);
  const [googleSheetsError, setGoogleSheetsError] = useState<string | null>(null);
  const [serviceAccountEmail, setServiceAccountEmail] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Branding & Settings
  const [settings, setSettings] = useState<any>({
    websiteTitle: "MCA Recording Portal",
    logoText: "MCA Recorder",
    faviconTitle: "MCA Records",
    faviconLogoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128",
    logoUrl: ""
  });

  // Settings Forms
  const [websiteTitleInput, setWebsiteTitleInput] = useState("");
  const [logoTextInput, setLogoTextInput] = useState("");
  const [faviconTitleInput, setFaviconTitleInput] = useState("");
  const [faviconLogoUrlInput, setFaviconLogoUrlInput] = useState("");
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [customSpreadsheetIdInput, setCustomSpreadsheetIdInput] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Admin Credentials Form
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminFullName, setNewAdminFullName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  // MCA Recording Input Form
  const [mcaPin, setMcaPin] = useState("");
  const [mcaFullName, setMcaFullName] = useState("");
  const [mcaAddress, setMcaAddress] = useState("");
  const [mcaFormError, setMcaFormError] = useState<string | null>(null);
  const [isSubmittingMca, setIsSubmittingMca] = useState(false);

  // Editing modal
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [editMcaPin, setEditMcaPin] = useState("");
  const [editMcaFullName, setEditMcaFullName] = useState("");
  const [editMcaAddress, setEditMcaAddress] = useState("");
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Deleting row confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch website settings
  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.serviceAccountEmail) setServiceAccountEmail(data.serviceAccountEmail);
        if (data.spreadsheetId) setSpreadsheetId(data.spreadsheetId);
        if (data.settings) {
          setSettings(data.settings);
          setWebsiteTitleInput(data.settings.websiteTitle || "");
          setLogoTextInput(data.settings.logoText || "");
          setFaviconTitleInput(data.settings.faviconTitle || "");
          setFaviconLogoUrlInput(data.settings.faviconLogoUrl || "");
          setLogoUrlInput(data.settings.logoUrl || "");
          setCustomSpreadsheetIdInput(data.settings.customSpreadsheetId || "");

          // Apply dynamic browser branding
          document.title = data.settings.faviconTitle || "MCA Records";
          const link: any = document.querySelector("link[rel~='icon']");
          if (link) {
            link.href = data.settings.faviconLogoUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128";
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  };

  // Fetch MCA recorded list
  const fetchRecords = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/db/data/mca_records", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error("Could not fetch recorded MCA files.");
      }
      const data = await response.json();
      setRows(data.rows || []);
    } catch (err: any) {
      setError(err.message || "Failed to load records database.");
    } finally {
      setIsLoading(false);
    }
  };

  // Combine checks
  const loadDashboardData = async () => {
    await fetchSettings();
    await fetchRecords();
    // Fetch google sheets connection status from tables config
    try {
      const response = await fetch("/api/db/tables", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setIsGoogleSheetsActive(!!data.isGoogleSheetsActive);
        setGoogleSheetsError(data.googleSheetsError || null);
        if (data.serviceAccountEmail) setServiceAccountEmail(data.serviceAccountEmail);
        if (data.spreadsheetId) setSpreadsheetId(data.spreadsheetId);
      }
    } catch (err) {
      console.error("Failed to query tables state:", err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Display message helper
  const showSuccessToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  // Validate MCA input
  const validateMcaInput = (pin: string, name: string): string | null => {
    const pinClean = pin.trim();
    if (!pinClean) {
      return "PIN field is required.";
    }
    if (pinClean.length !== 12 || !/^\d+$/.test(pinClean)) {
      return "PIN must be exactly 12 numeric digits.";
    }
    if (!name.trim()) {
      return "Full Name field is required.";
    }
    return null;
  };

  // Insert raw MCA Record
  const handleCreateMca = async (e: React.FormEvent) => {
    e.preventDefault();
    setMcaFormError(null);

    const validationErr = validateMcaInput(mcaPin, mcaFullName);
    if (validationErr) {
      setMcaFormError(validationErr);
      return;
    }

    setIsSubmittingMca(true);
    try {
      const response = await fetch("/api/db/data/mca_records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pin: mcaPin.trim(),
          fullName: mcaFullName.trim(),
          address: mcaAddress.trim(),
          createdAt: new Date().toISOString().split("T")[0]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit recording.");
      }

      showSuccessToast("MCA Record saved and synchronized successfully!");
      setMcaPin("");
      setMcaFullName("");
      setMcaAddress("");
      fetchRecords(); // Refresh list
    } catch (err: any) {
      setMcaFormError(err.message || "Submission failed.");
    } finally {
      setIsSubmittingMca(false);
    }
  };

  // Edit record
  const handleStartEdit = (row: any) => {
    setEditingRow(row);
    setEditMcaPin(row.pin || "");
    setEditMcaFullName(row.fullName || "");
    setEditMcaAddress(row.address || "");
    setEditFormError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;

    const validationErr = validateMcaInput(editMcaPin, editMcaFullName);
    if (validationErr) {
      setEditFormError(validationErr);
      return;
    }

    setIsSavingEdit(true);
    try {
      const response = await fetch(`/api/db/data/mca_records/${editingRow.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          pin: editMcaPin.trim(),
          fullName: editMcaFullName.trim(),
          address: editMcaAddress.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save edits.");
      }

      showSuccessToast("MCA Record updated successfully!");
      setEditingRow(null);
      fetchRecords();
    } catch (err: any) {
      setEditFormError(err.message || "Failed to save edits.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete record
  const handleDeleteRow = async (id: string) => {
    try {
      const response = await fetch(`/api/db/data/mca_records/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error("Unable to delete record from storage.");
      }
      showSuccessToast("Record deleted successfully.");
      setDeletingId(null);
      fetchRecords();
    } catch (err: any) {
      alert(err.message || "Deletion failed.");
    }
  };

  // Update Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          websiteTitle: websiteTitleInput.trim(),
          logoText: logoTextInput.trim(),
          faviconTitle: faviconTitleInput.trim(),
          faviconLogoUrl: faviconLogoUrlInput.trim(),
          logoUrl: logoUrlInput.trim(),
          customSpreadsheetId: customSpreadsheetIdInput.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update branding settings.");
      }

      showSuccessToast("Branding settings saved successfully.");
      fetchSettings();
    } catch (err: any) {
      alert(err.message || "Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Create new Admin
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUsername.trim() || !newAdminPassword.trim() || !newAdminFullName.trim()) {
      alert("Please fill in Username, Password, and Full Name.");
      return;
    }

    setIsCreatingAdmin(true);
    try {
      const response = await fetch("/api/admin/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newAdminUsername.trim(),
          password: newAdminPassword.trim(),
          fullName: newAdminFullName.trim(),
          email: newAdminEmail.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create administrator credential.");
      }

      showSuccessToast("New Admin credential added successfully!");
      setNewAdminUsername("");
      setNewAdminPassword("");
      setNewAdminFullName("");
      setNewAdminEmail("");
    } catch (err: any) {
      alert(err.message || "Failed to create administrator.");
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  // Export records as CSV
  const handleExportCSV = () => {
    if (rows.length === 0) return;
    const headers = ["ID", "PIN", "Full Name", "Address", "Created At"];
    const csvContent = [
      headers.join(","),
      ...rows.map(r => [
        `"${r.id || ""}"`,
        `"${r.pin || ""}"`,
        `"${(r.fullName || "").replace(/"/g, '""')}"`,
        `"${(r.address || "").replace(/"/g, '""')}"`,
        `"${r.createdAt || ""}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `mca_records_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered rows for the list view
  const filteredRows = rows.filter(row => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = (
      (row.pin && row.pin.includes(q)) ||
      (row.fullName && row.fullName.toLowerCase().includes(q)) ||
      (row.address && row.address.toLowerCase().includes(q))
    );

    // Date filtering
    let matchesDate = true;
    if (row.createdAt) {
      // row.createdAt is formatted like "YYYY-MM-DD"
      const rowDate = row.createdAt;
      if (startDate && rowDate < startDate) {
        matchesDate = false;
      }
      if (endDate && rowDate > endDate) {
        matchesDate = false;
      }
    } else {
      // If no createdAt, and we have a date filter set, exclude it
      if (startDate || endDate) {
        matchesDate = false;
      }
    }

    return matchesSearch && matchesDate;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 print:bg-white print:text-slate-950 font-sans flex flex-col md:flex-row relative overflow-hidden">
      {/* Background soft lighting */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-slate-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* SIDEBAR FOR DESKTOP / TOPBAR FOR MOBILE */}
      <aside className="print:hidden w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 shrink-0 flex flex-col z-20">
        {/* Header Branding */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img 
                src={settings.logoUrl} 
                alt={settings.logoText} 
                className="w-10 h-10 object-contain rounded-xl border border-slate-700 bg-slate-950" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="p-2 bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-xl">
                <Database className="w-5 h-5" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white line-clamp-1">
                {settings.logoText}
              </h2>
              <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase block">Recording Engine</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="p-4 flex-1 space-y-1.5">
          <button
            onClick={() => setActiveTab("record")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === "record" 
                ? "bg-blue-600/10 border border-blue-500/30 text-blue-400" 
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Record New MCA</span>
          </button>

          <button
            onClick={() => setActiveTab("list")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === "list" 
                ? "bg-blue-600/10 border border-blue-500/30 text-blue-400" 
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>MCA Recorded ({rows.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === "settings" 
                ? "bg-blue-600/10 border border-blue-500/30 text-blue-400" 
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Portal Settings</span>
          </button>
        </nav>

        {/* Sync Connection Banner inside Sidebar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isGoogleSheetsActive ? "bg-emerald-500" : "bg-amber-500"}`} />
              <span className="text-[10px] font-semibold text-slate-300 font-mono tracking-wide uppercase">
                {isGoogleSheetsActive ? "Google Sheet Sync" : "Local Cache DB"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
              {isGoogleSheetsActive 
                ? "Real-time synchronization with service credentials is active." 
                : "Synchronization is offline. Saving records to local cache."}
            </p>
            {!isGoogleSheetsActive && googleSheetsError && (
              <div className="text-[9px] text-amber-500 font-mono border-t border-slate-800/60 pt-1.5 mt-1.5 break-all max-h-16 overflow-y-auto leading-normal">
                <span className="font-semibold block text-[10px] text-amber-400 font-sans">Sync Error:</span>
                {googleSheetsError}
              </div>
            )}
            <button 
              onClick={loadDashboardData}
              className="w-full mt-2.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 py-1 px-2 text-[10px] font-mono text-slate-300 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Validate & Pull</span>
            </button>
          </div>
        </div>

        {/* User profile footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xs text-blue-400 shrink-0">
              {user.avatar || "🛡️"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user.fullName}</p>
              <p className="text-[10px] text-slate-500 truncate font-mono">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            title="End admin session"
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MAIN LAYOUT CANVAS */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 z-10 flex flex-col min-w-0">
        
        {/* TOAST SYSTEM (SUCCESS/SYNC) */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-6 right-6 z-50 max-w-md bg-emerald-950/90 border border-emerald-500/30 text-emerald-300 px-4 py-3.5 rounded-xl shadow-2xl flex items-start gap-3 backdrop-blur-md"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-white">Action Sync Complete</p>
                <p className="text-[11px] text-slate-300 mt-0.5">{successMessage}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* DATABASE WARNING BANNER FOR 404 OR OTHER ISSUES */}
        {!isGoogleSheetsActive && googleSheetsError && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3.5 backdrop-blur-sm shadow-lg max-w-4xl animate-in fade-in slide-in-from-top-4 duration-300">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-white text-sm">Google Sheets Connection Alert</p>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                The app was unable to load data from your configured Google Spreadsheet, so it has safely fallen back to the local database file (<code className="bg-slate-950 px-1 py-0.5 rounded text-amber-400">database.json</code>). You can still record, edit, and delete entries normally!
              </p>
              <div className="p-2.5 bg-slate-950/80 rounded-xl mt-2 text-[10px] font-mono border border-slate-900 leading-normal text-slate-400 break-all select-all">
                <span className="font-semibold text-amber-400 block text-[11px] mb-0.5 font-sans font-medium">Error Details:</span>
                {googleSheetsError}
              </div>
              <p className="text-[10px] text-slate-400 font-sans mt-2 leading-relaxed">
                💡 <span className="font-semibold text-slate-300">How to fix this:</span>
              </p>
              <ul className="list-disc pl-4 text-[10px] text-slate-400 font-sans space-y-1 mt-1 leading-normal">
                <li>
                  Verify that your Spreadsheet ID is correct: <code className="bg-slate-950 px-1 text-[9px] rounded select-all font-mono text-amber-400">{spreadsheetId || "Not Configured"}</code>
                </li>
                {serviceAccountEmail ? (
                  <li>
                    Open your Google Sheet, click <strong className="text-slate-300">Share</strong>, and add this Service Account email as an <strong className="text-slate-300">Editor</strong> (no notification email needed): <code className="bg-slate-950 px-1 text-[9px] rounded select-all font-mono text-amber-400">{serviceAccountEmail}</code>
                  </li>
                ) : (
                  <li>
                    Ensure that <code className="bg-slate-950 px-1 text-[9px] rounded font-mono">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> and <code className="bg-slate-950 px-1 text-[9px] rounded font-mono">GOOGLE_PRIVATE_KEY</code> environment secrets are configured.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* TAB 1: RECORD NEW MCA FORM */}
        {activeTab === "record" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto w-full py-6"
          >
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-white">Record MCA Entry</h1>
              <p className="text-sm text-slate-400 mt-1">
                Enter secure MCA credentials. Submitted data automatically appends to the verified Google Sheets database.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              {/* Header Gradient line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
              
              <form onSubmit={handleCreateMca} className="space-y-5">
                
                {/* PIN INPUT FIELD (strict 12 numbers) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    PIN (12 Numbers) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={12}
                      value={mcaPin}
                      onChange={(e) => setMcaPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter exactly 12-digit PIN number"
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all font-mono"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
                      {mcaPin.length}/12 Digits
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 font-mono">
                    Must be completely numeric and strictly 12 numbers max/min.
                  </p>
                </div>

                {/* FULL NAME */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={mcaFullName}
                    onChange={(e) => setMcaFullName(e.target.value)}
                    placeholder="Enter record full name"
                    className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                  />
                </div>

                {/* ADDRESS */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Address
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">Blank Permitted</span>
                  </div>
                  <textarea
                    rows={3}
                    value={mcaAddress}
                    onChange={(e) => setMcaAddress(e.target.value)}
                    placeholder="Enter physical address details (or leave empty)"
                    className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 outline-none transition-all"
                  />
                </div>

                {/* Error Banner */}
                {mcaFormError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl flex gap-2.5 items-start text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block mb-0.5">Validation Fault</span>
                      {mcaFormError}
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmittingMca}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-sm py-3 px-4 rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingMca ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Recording & Uploading to Sheets...</span>
                    </>
                  ) : (
                    <>
                      <span>Secure Register MCA Record</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

              </form>
            </div>
          </motion.div>
        )}

        {/* TAB 2: MCA RECORDED VIEW */}
        {activeTab === "list" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex-1 flex flex-col"
          >
            {/* Print-only report header */}
            <div className="hidden print:block mb-6 border-b border-slate-300 pb-4 text-slate-950">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight">
                    {settings.websiteTitle || "MCA Recording Portal"}
                  </h1>
                  <p className="text-xs text-slate-600 mt-1">
                    MCA Recorded Files Register Report
                  </p>
                </div>
                <div className="text-right text-[10px] text-slate-500 font-mono">
                  <div>Date printed: {new Date().toLocaleDateString()}</div>
                  <div>Time printed: {new Date().toLocaleTimeString()}</div>
                </div>
              </div>
              <div className="flex gap-4 mt-3 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div><strong>Total Records:</strong> {filteredRows.length}</div>
                {startDate && <div><strong>Start Date Filter:</strong> {startDate}</div>}
                {endDate && <div><strong>End Date Filter:</strong> {endDate}</div>}
                {searchQuery && <div><strong>Search Query:</strong> &ldquo;{searchQuery}&rdquo;</div>}
              </div>
            </div>

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">MCA Recorded Files</h1>
                <p className="text-sm text-slate-400 mt-1">
                  Total recordings registered in standard cloud-synced storage system.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  disabled={rows.length === 0}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 border border-slate-800 text-slate-300 py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                  title="Print current report"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={rows.length === 0}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 border border-slate-800 text-slate-300 py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={fetchRecords}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 p-2.5 rounded-xl cursor-pointer transition-colors"
                  title="Reload table"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter / Search row */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 mb-4 flex flex-col lg:flex-row items-center gap-3 print:hidden">
              <div className="relative w-full lg:flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by PIN, Full Name, or Address details..."
                  className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs rounded-lg pl-10 pr-4 py-2 outline-none focus:border-blue-500/60 transition-all"
                />
              </div>

              {/* Date Filters */}
              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300 min-w-[140px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">From</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer [color-scheme:dark] w-full"
                  />
                </div>

                <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300 min-w-[140px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">To</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-slate-200 text-xs outline-none cursor-pointer [color-scheme:dark] w-full"
                  />
                </div>

                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Clear Dates
                  </button>
                )}
              </div>
            </div>

            {/* Records Table Card */}
            <div className="bg-slate-900 border border-slate-800 print:border-none print:shadow-none print:bg-white rounded-2xl flex-1 flex flex-col overflow-hidden shadow-xl">
              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500">
                  <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-3" />
                  <span className="text-xs font-mono">Accessing synced storage arrays...</span>
                </div>
              ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
                  <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                  <p className="text-sm font-semibold text-white">Database Retrieval Fault</p>
                  <p className="text-xs text-slate-400 mt-1">{error}</p>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 text-center">
                  <div className="p-4 bg-slate-950 rounded-full mb-3 text-slate-600">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-semibold text-slate-400">No Records Found</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {searchQuery ? "No matches fit the active filter criteria." : "Get started by recording your first MCA record!"}
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/60 text-slate-400 print:bg-slate-100 print:text-slate-950 print:border-b-2 print:border-slate-300 uppercase tracking-wider font-semibold border-b border-slate-800">
                        <th className="py-3 px-4 print:text-slate-950">ID</th>
                        <th className="py-3 px-4 print:text-slate-950">PIN Code (12 Digits)</th>
                        <th className="py-3 px-4 print:text-slate-950">Full Name</th>
                        <th className="py-3 px-4 print:text-slate-950">Address</th>
                        <th className="py-3 px-4 print:text-slate-950">Registered Date</th>
                        <th className="py-3 px-4 text-right print:hidden">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 print:divide-slate-300 font-mono">
                      {filteredRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-800/30 print:hover:bg-transparent transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-500 print:text-slate-950">{row.id}</td>
                          <td className="py-3.5 px-4 text-blue-400 print:text-blue-900 font-bold tracking-wide">{row.pin}</td>
                          <td className="py-3.5 px-4 text-slate-200 print:text-slate-950 font-sans font-medium">{row.fullName}</td>
                          <td className="py-3.5 px-4 text-slate-400 print:text-slate-800 font-sans max-w-xs truncate" title={row.address}>
                            {row.address || <span className="text-slate-600 italic">Blank</span>}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 print:text-slate-600 text-[11px]">{row.createdAt || "N/A"}</td>
                          <td className="py-3.5 px-4 text-right print:hidden">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleStartEdit(row)}
                                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg cursor-pointer transition-colors"
                                title="Edit Record"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingId(row.id)}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer transition-colors"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 3: PORTAL SETTINGS & NEW ADMIN */}
        {activeTab === "settings" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto w-full py-6 space-y-8"
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Portal Administration</h1>
              <p className="text-sm text-slate-400 mt-1">
                Configure visual branding presets and add administrator login credentials below.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* BRANDING SETUP BOX */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="w-4 h-4 text-blue-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Branding & Logo Configuration</h2>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Website Title
                    </label>
                    <input
                      type="text"
                      value={websiteTitleInput}
                      onChange={(e) => setWebsiteTitleInput(e.target.value)}
                      placeholder="e.g. MCA Recording Portal"
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 text-xs focus:border-blue-500/60 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Logo Text
                    </label>
                    <input
                      type="text"
                      value={logoTextInput}
                      onChange={(e) => setLogoTextInput(e.target.value)}
                      placeholder="e.g. MCA Recorder"
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 text-xs focus:border-blue-500/60 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Favicon Title
                    </label>
                    <input
                      type="text"
                      value={faviconTitleInput}
                      onChange={(e) => setFaviconTitleInput(e.target.value)}
                      placeholder="e.g. MCA Records"
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 text-xs focus:border-blue-500/60 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Favicon Logo URL
                    </label>
                    <input
                      type="text"
                      value={faviconLogoUrlInput}
                      onChange={(e) => setFaviconLogoUrlInput(e.target.value)}
                      placeholder="Image address URL"
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 text-xs focus:border-blue-500/60 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Main Logo URL (Leave blank for fallback)
                    </label>
                    <input
                      type="text"
                      value={logoUrlInput}
                      onChange={(e) => setLogoUrlInput(e.target.value)}
                      placeholder="Image address URL"
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 text-xs focus:border-blue-500/60 outline-none transition-all"
                    />
                  </div>

                  <div className="border-t border-slate-800/80 pt-4 mt-4">
                    <label className="block text-[11px] font-semibold text-amber-400 uppercase tracking-wide mb-1">
                      Custom Google Spreadsheet ID Override (Optional)
                    </label>
                    <span className="block text-[10px] text-slate-500 mb-2 leading-relaxed">
                      Override the default Spreadsheet ID. Paste the ID of your custom Google Sheet (the long string between &ldquo;/d/&rdquo; and &ldquo;/edit&rdquo; in the URL). Make sure to share your sheet with the service account email as an Editor first!
                    </span>
                    <input
                      type="text"
                      value={customSpreadsheetIdInput}
                      onChange={(e) => setCustomSpreadsheetIdInput(e.target.value)}
                      placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..."
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-700 rounded-lg px-3 py-2 text-xs focus:border-amber-500/60 outline-none transition-all font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs py-2 px-3 rounded-lg shadow-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isSavingSettings ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Saving visual parameters...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Custom Branding</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* CREATE ADMIN CREDENTIALS */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Add Admin Credentials</h2>
                </div>

                <form onSubmit={handleCreateAdmin} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newAdminFullName}
                      onChange={(e) => setNewAdminFullName(e.target.value)}
                      placeholder="e.g. Alice Cooper"
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 text-xs focus:border-blue-500/60 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Security Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newAdminUsername}
                      onChange={(e) => setNewAdminUsername(e.target.value)}
                      placeholder="Enter username"
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 text-xs focus:border-blue-500/60 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Password Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 text-xs focus:border-blue-500/60 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="e.g. alice@mcarecordings.com"
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-lg px-3 py-2 text-xs focus:border-blue-500/60 outline-none transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingAdmin}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs py-2 px-3 rounded-lg shadow-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isCreatingAdmin ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Registering user in sheet DB...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add New Administrator</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

            </div>
          </motion.div>
        )}

      </main>

      {/* EDIT MODAL DIALOG */}
      <AnimatePresence>
        {editingRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative"
            >
              {/* Top border line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
              
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit className="w-4 h-4 text-blue-400" />
                  <span>Edit MCA Record {editingRow.id}</span>
                </h3>
                <button
                  onClick={() => setEditingRow(null)}
                  className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                
                {/* PIN (Strictly 12 numeric) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    PIN (12 Numbers Required)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={12}
                      value={editMcaPin}
                      onChange={(e) => setEditMcaPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter exactly 12-digit PIN"
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-xs focus:border-blue-500/60 outline-none transition-all font-mono"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
                      {editMcaPin.length}/12
                    </div>
                  </div>
                </div>

                {/* FULL NAME */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editMcaFullName}
                    onChange={(e) => setEditMcaFullName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-xs focus:border-blue-500/60 outline-none transition-all"
                  />
                </div>

                {/* ADDRESS */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Address (Can remain Blank)
                  </label>
                  <textarea
                    rows={3}
                    value={editMcaAddress}
                    onChange={(e) => setEditMcaAddress(e.target.value)}
                    placeholder="Address particulars"
                    className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-xs focus:border-blue-500/60 outline-none transition-all"
                  />
                </div>

                {/* Form Errors */}
                {editFormError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg flex gap-2.5 items-start text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>{editFormError}</div>
                  </div>
                )}

                {/* Modal footer Actions */}
                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingRow(null)}
                    className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingEdit ? "Saving..." : "Save Record Changes"}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE DIALOG */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl relative p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-red-400">
                <Trash2 className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-white">Delete MCA Record?</h3>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Are you sure you want to delete MCA Record <span className="font-semibold text-slate-200">{deletingId}</span>? This action is irreversible and will synchronize instantly to your connected Google Sheet.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeletingId(null)}
                  className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteRow(deletingId)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
