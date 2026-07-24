"use client";

import { motion } from "framer-motion";
import { Activity, LogOut, ShieldCheck, Wrench } from "lucide-react";

interface User {
  username: string;
  fullName: string;
  role: string;
  company?: string;
}

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

function roleLabel(role?: string) {
  if (role?.toLowerCase() === "admin") return "ผู้ดูแลระบบ";
  if (role?.toLowerCase() === "technician") return "ช่างผู้เชี่ยวชาญ";
  return "ผู้ใช้งาน Ward";
}

export function Header({ user, onLogout }: HeaderProps) {
  const isTechnician = user?.role?.toLowerCase() === "technician";
  const displayName = user?.fullName || user?.username || "ผู้ใช้งาน";

  return (
    <header className="relative overflow-hidden bg-[#062f43] px-4 pb-7 pt-4 text-white sm:px-6 sm:pb-8 sm:pt-5">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(125,211,252,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="pointer-events-none absolute -right-20 top-[-7rem] h-72 w-72 rounded-full border border-sky-300/15 bg-sky-300/5" />
      <div className="pointer-events-none absolute right-12 top-8 h-36 w-36 rounded-full border border-emerald-300/10" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100/65">
          <span>Clinical Laboratory · Blood Gas Operations</span>
          <span className="hidden sm:block">Audit-ready workspace</span>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3.5"
          >
            <div className="relative grid h-[3.25rem] w-[3.25rem] shrink-0 place-items-center rounded-[1.15rem] border border-sky-200/30 bg-sky-300/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_30px_rgba(0,0,0,0.2)]">
              <Activity size={27} strokeWidth={2.2} className="text-sky-100" />
              <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-emerald-300 ring-4 ring-[#0c4057]" />
            </div>
            <div>
              <h1 className="text-[1.45rem] font-extrabold leading-none tracking-tight sm:text-2xl">Blood Gas Tracker</h1>
              <p className="mt-2 text-xs font-medium tracking-wide text-sky-100/75">บันทึกน้ำยา งานบำรุงรักษา และประวัติการปฏิบัติงาน</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/[0.07] p-2 pl-3 backdrop-blur-md sm:justify-start"
          >
            <div className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-extrabold ${isTechnician ? "bg-indigo-300 text-indigo-950" : "bg-sky-200 text-sky-950"}`}>
              {displayName.charAt(0)}
            </div>
            <div className="min-w-0 pr-1">
              <p className="truncate text-sm font-bold leading-tight text-white">{displayName}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-100/70">
                {isTechnician ? <Wrench size={11} /> : <ShieldCheck size={11} />}
                {user?.company || roleLabel(user?.role)}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-sky-100 transition hover:border-rose-200/30 hover:bg-rose-400/15 hover:text-rose-100 focus:outline-none focus:ring-2 focus:ring-sky-200"
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
            >
              <LogOut size={18} />
            </button>
          </motion.div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-1.5" aria-label="กลุ่มข้อมูลที่ติดตาม">
          <div className="h-1.5 rounded-full bg-sky-300" title="Reagent" />
          <div className="h-1.5 rounded-full bg-violet-300" title="Wash" />
          <div className="h-1.5 rounded-full bg-emerald-300" title="QC" />
        </div>
        <div className="mt-2 flex justify-between px-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-sky-100/55">
          <span>Reagent</span><span>Wash</span><span>QC</span>
        </div>
      </div>
    </header>
  );
}
