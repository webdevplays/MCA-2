import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import { User } from "./types";
import { Database } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Auto-verify token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("database_portal_token");
    if (!storedToken) {
      setIsInitializing(false);
      return;
    }

    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${storedToken}` }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setToken(storedToken);
        } else {
          // Token expired or invalid
          localStorage.removeItem("database_portal_token");
        }
      } catch (err) {
        console.error("Session verification failed:", err);
      } finally {
        setIsInitializing(false);
      }
    };

    checkSession();
  }, []);

  const handleLoginSuccess = (loggedInUser: User, sessionToken: string) => {
    setUser(loggedInUser);
    setToken(sessionToken);
    localStorage.setItem("database_portal_token", sessionToken);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("database_portal_token");
  };

  return (
    <AnimatePresence mode="wait">
      {isInitializing ? (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4"
        >
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)] animate-bounce">
              <Database className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wider uppercase font-mono">
                Authorizing Portal Session...
              </h2>
              <p className="text-[11px] text-slate-500 mt-1">Verifying encrypted server-side connection</p>
            </div>
          </div>
        </motion.div>
      ) : user && token ? (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen bg-slate-950"
        >
          <Dashboard user={user} token={token} onLogout={handleLogout} />
        </motion.div>
      ) : (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen bg-slate-950"
        >
          <Login onLoginSuccess={handleLoginSuccess} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
