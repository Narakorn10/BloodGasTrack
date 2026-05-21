"use client";

import { motion } from "framer-motion";
import { LogOut, User, Activity } from "lucide-react";

interface HeaderProps {
  user: any;
  onLogout: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="relative bg-[#0a4d68] text-white pt-8 pb-14 px-6 overflow-hidden">
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl" />

      <div className="max-w-6xl mx-auto flex justify-between items-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner border border-white/30">
            <Activity className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Blood Gas Tracker</h1>
            <p className="text-sky-200/80 text-xs font-medium uppercase tracking-[0.2em]">Clinical Laboratory System</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <div className="hidden sm:flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
            <div className="w-8 h-8 bg-sky-400 rounded-full flex items-center justify-center font-bold text-sky-900 text-sm">
              {user?.fullName?.charAt(0) || user?.username?.charAt(0) || '?'}
            </div>
            <div className="text-left">
              <div className="text-sm font-bold leading-none">{user?.fullName || user?.username || 'Guest'}</div>
              <div className="text-[10px] text-sky-200 font-medium uppercase tracking-wider">{user?.role || 'User'}</div>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="p-3 bg-white/10 hover:bg-rose-500/20 hover:text-rose-200 rounded-2xl border border-white/10 transition-all duration-300 group"
            title="ออกจากระบบ"
          >
            <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </motion.div>
      </div>

      {/* Modern Wave Divider */}
      <div className="absolute bottom-0 left-0 w-full h-8 bg-[#f8fafc] rounded-t-[32px]" />
    </header>
  );
}
