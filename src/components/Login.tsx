import React, { useState, useEffect } from "react";
import { Lock, User, AlertCircle, Database, Shield, ChevronRight } from "lucide-react";
import { motion } from "motion/react";

interface LoginProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>({
    websiteTitle: "MCA Recording Portal",
    logoText: "MCA Recorder",
    faviconTitle: "MCA Records",
    faviconLogoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128",
    logoUrl: ""
  });

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        if (data && data.settings) {
          setSettings(data.settings);
          document.title = data.settings.faviconTitle || "MCA Records";
          const link: any = document.querySelector("link[rel~='icon']");
          if (link) {
            link.href = data.settings.faviconLogoUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128";
          }
        }
      })
      .catch(err => console.error("Failed to load settings:", err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      // Success! Pass token and user info up
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || "Unable to reach the secure database authentication server.");
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickCredentials = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* App Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            {settings.logoUrl ? (
              <img 
                src={settings.logoUrl} 
                alt={settings.logoText} 
                className="w-16 h-16 object-contain rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.1)] border border-slate-800" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                <Database className="w-8 h-8" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {settings.websiteTitle}
          </h1>
          <p className="text-sm text-slate-400 mt-1.5">
            {settings.logoText} Secure Recording Console
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
          
          <h2 className="text-lg font-semibold text-white mb-6">System Log In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter administrator username"
                  className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all font-mono"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                Security Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950/60 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all font-mono"
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex gap-2.5 items-start text-xs"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block mb-0.5">Connection Error</span>
                  {error}
                </div>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm py-2.5 px-4 rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 active:bg-blue-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Connecting to Database...</span>
                </>
              ) : (
                <>
                  <span>Initialize Portal Session</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick logins for convenience/sandbox testing */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <span className="text-xs text-slate-500 block mb-2.5 font-medium">
              Demo Administrator Key (Direct Server Database Auth)
            </span>
            <div className="grid grid-cols-1">
              <button
                type="button"
                onClick={() => fillQuickCredentials("admin", "admin123")}
                className="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-lg p-2.5 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 font-mono mb-0.5">
                  <Shield className="w-3 h-3" />
                  <span>ADMINISTRATOR</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">admin / admin123</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-slate-600">
          Secure Session API Engine v1.2.0 • Running on Port 3000
        </div>
      </motion.div>
    </div>
  );
}
