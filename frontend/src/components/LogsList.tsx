"use client";

import { motion } from "framer-motion";
import { fmtDT, fmtD } from "@/lib/utils";
import { User, Calendar, CheckCircle2, Trash2, MessageCircle } from "lucide-react";

interface BloodGasRecord {
  timestamp: string;
  ward: string;
  worker: string;
  reagent: number;
  reagentExpiry: string;
  reagentLot: string;
  wash: number;
  washExpiry: string;
  washLot: string;
  qc: number;
  qcExpiry: string;
  qcLot: string;
  comment: string;
  deprotein: boolean;
  condition: boolean;
  waste: string;
}

export function LogsList({ logs }: { logs: BloodGasRecord[] }) {
  if (!logs || logs.length === 0) {
    return <div className="py-10 text-center text-slate-400">ยังไม่มีประวัติการบันทึก</div>;
  }

  return (
    <div className="space-y-4">
      {logs.map((log, index) => {
        if (log.ward === '(Login)') return null;

        return (
          <motion.div
            key={log.timestamp + index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-md transition-all duration-300"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 group-hover:bg-sky-50 group-hover:text-sky-600 transition-colors">
                  <User size={20} />
                </div>
                <div>
                  <div className="font-bold text-slate-800">{log.ward}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <User size={12} /> {log.worker || 'ไม่ทราบชื่อ'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-600 flex items-center md:justify-end gap-1.5">
                  <Calendar size={14} /> {fmtDT(log.timestamp)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-400" /> Reagent
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold font-mono text-slate-700">{log.reagent}%</span>
                  <span className="text-[10px] text-slate-400">Exp: {fmtD(log.reagentExpiry)}</span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Wash
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold font-mono text-slate-700">{log.wash}%</span>
                  <span className="text-[10px] text-slate-400">Exp: {fmtD(log.washExpiry)}</span>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> QC
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold font-mono text-slate-700">{log.qc}%</span>
                  <span className="text-[10px] text-slate-400">Exp: {fmtD(log.qcExpiry)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              {log.deprotein && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-100 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Deprotein
                </span>
              )}
              {log.condition && (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-100 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Condition
                </span>
              )}
              {log.waste === 'ทิ้ง Waste' && (
                <span className="px-2.5 py-1 bg-rose-50 text-rose-700 text-[11px] font-bold rounded-lg border border-rose-100 flex items-center gap-1">
                  <Trash2 size={12} /> ทิ้ง Waste
                </span>
              )}
            </div>

            {log.comment && (
              <div className="mt-2 bg-slate-50 rounded-xl p-3 text-sm text-slate-600 italic flex gap-2 border border-slate-100">
                <MessageCircle size={16} className="text-slate-400 shrink-0 mt-0.5" />
                &quot;{log.comment}&quot;
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
