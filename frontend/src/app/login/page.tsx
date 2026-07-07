"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { api } from "@/lib/api";
import { Eye, EyeOff, Activity, Loader2, User, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  const performLogin = useCallback(async (u: string, p: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("login", { username: u, password: p });
      if (res.success) {
        localStorage.setItem("user", JSON.stringify({ ...res.user, sessionToken: res.sessionToken || "" }));
        localStorage.setItem("cred", p); // Store for subsequent requests auth
        if (res.sessionToken) {
          localStorage.setItem("sessionToken", res.sessionToken);
        }
        router.push("/dashboard");
      } else {
        setError(res.message || "Username หรือ Password ไม่ถูกต้อง");
      }
    } catch {
      setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // 1. Check if already logged in
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      router.push("/dashboard");
      return;
    }

    // 2. Auto-login via URL parameters (e.g., ?u=admin&p=1234)
    const u = searchParams.get("u");
    const p = searchParams.get("p");
    if (u && p) {
      // Defer execution to avoid cascading render error during initial mount
      const timer = setTimeout(() => {
        performLogin(u, p);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [router, searchParams, performLogin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(username, password);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4 }}
      className="bg-white/70 backdrop-blur-2xl rounded-[3rem] p-10 sm:p-12 border border-white shadow-2xl shadow-slate-300/40 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-sky-500 via-emerald-500 to-indigo-500" />
      
      <form onSubmit={handleLogin} className="space-y-8 relative z-10">
        <div className="space-y-2.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Username</label>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors">
              <User size={20} />
            </div>
            <input
              type="text"
              placeholder="กรอกชื่อผู้ใช้ของคุณ"
              className="w-full pl-14 pr-5 py-5 bg-slate-100/50 border-2 border-transparent rounded-[1.5rem] outline-none focus:border-sky-400 focus:bg-white transition-all text-slate-700 font-bold text-base"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors">
              <Lock size={20} />
            </div>
            <input
              type={showPwd ? "text" : "password"}
              placeholder="กรอกรหัสผ่าน"
              className="w-full pl-14 pr-14 py-5 bg-slate-100/50 border-2 border-transparent rounded-[1.5rem] outline-none focus:border-sky-400 focus:bg-white transition-all text-slate-700 font-bold text-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-rose-50 text-rose-600 text-[12px] font-bold p-5 rounded-2xl border border-rose-100 flex items-center gap-3"
            >
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.02, backgroundColor: "#088395" }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className="w-full bg-[#0a4d68] text-white py-5 rounded-[1.5rem] font-extrabold text-xl shadow-xl shadow-sky-900/30 flex items-center justify-center gap-3 transition-all disabled:opacity-50 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          {loading ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <>
              <span className="relative z-10">เข้าสู่ระบบ</span>
              <ArrowRight size={24} className="relative z-10 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Dynamic Background Orbs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 50, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-sky-200/50 rounded-full blur-3xl" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -40, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-100/50 rounded-full blur-3xl" 
      />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-md z-10"
      >
        {/* Logo Section */}
        <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0.5, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
            className="w-24 h-24 bg-gradient-to-br from-[#0a4d68] to-[#088395] rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-sky-900/30 border border-white/20 relative"
          >
            <Activity className="text-white" size={48} />
            <div className="absolute -right-2 -bottom-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-[#f8fafc] flex items-center justify-center">
              <ShieldCheck className="text-white" size={16} />
            </div>
          </motion.div>
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight mb-3">Blood Gas Tracker</h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.25em] text-[11px] opacity-80">Clinical Laboratory Portal</p>
        </div>

        {/* Login Card with Suspense for useSearchParams */}
        <Suspense fallback={
          <div className="bg-white/70 backdrop-blur-2xl rounded-[3rem] p-12 border border-white flex flex-col items-center justify-center gap-4 h-[400px]">
            <Loader2 className="animate-spin text-sky-500" size={40} />
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Checking URL...</p>
          </div>
        }>
          <LoginForm />
        </Suspense>

        {/* Footer Info */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-center"
        >
          <p className="text-[12px] text-slate-400 font-bold leading-relaxed mb-4">
            ติดต่อแผนก IT หรือ Admin สำหรับสิทธิ์การใช้งานใหม่
          </p>
          <div className="flex justify-center gap-4 text-slate-300">
            <div className="w-1.5 h-1.5 rounded-full bg-current" />
            <div className="w-1.5 h-1.5 rounded-full bg-current" />
            <div className="w-1.5 h-1.5 rounded-full bg-current" />
          </div>
          <p className="mt-4 text-[10px] text-slate-400 font-medium uppercase tracking-[0.3em]">
            © 2026 Clinical Lab Systems
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
