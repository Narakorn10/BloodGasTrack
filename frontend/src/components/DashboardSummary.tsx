"use client";

import { motion } from "framer-motion";
import { fmtDT, fmtD } from "@/lib/utils";
import { AlertTriangle, Clock, User, MessageCircle, CheckCircle2, Trash2 } from "lucide-react";

interface GaugeProps {
  label: string;
  val: number;
  exp: string;
  lot: string;
  color: string;
  icon: React.ReactNode;
}

export function CompactGauge({ label, val, exp, lot, color, icon }: GaugeProps) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const numericVal = Number(val) || 0;
  const progress = (numericVal / 100) * circumference;
  
  const diff = exp ? Math.floor((new Date(exp).getTime() - new Date().setHours(0,0,0,0)) / 86400000) : 999;
  const isCritical = diff < 0 || numericVal < 10;
  const isWarning = (diff >= 0 && diff <= 30) || (numericVal >= 10 && numericVal <= 25);

  const strokeColor = color;

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 relative overflow-hidden shadow-sm">
      {/* Small Circular Gauge */}
      <div className="relative w-16 h-16 shrink-0">
        <svg className="w-full h-full gauge-ring">
          <circle
            cx="32" cy="32" r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth="6"
          />
          <motion.circle
            cx="32" cy="32" r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth="6"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 0.5, ease: "linear" }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold font-mono leading-none" style={{ color: strokeColor }}>{numericVal}</span>
          <span className="text-[9px] font-bold" style={{ color: strokeColor }}>%</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: strokeColor }} />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{label}</span>
        </div>
        <div className="text-[10px] font-bold text-slate-400 truncate mb-0.5">
          LOT: <span className="text-slate-600">{lot || '–'}</span>
        </div>
        <div className={`text-[11px] font-semibold truncate ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-400'}`}>
          {exp ? `Exp: ${fmtD(exp)}` : '–'}
        </div>
      </div>

      {isCritical && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />}
    </div>
  );
}

export function DashboardSummary({ record }: { record: any }) {
  if (!record) return (
    <div className="py-10 text-center space-y-3">
      <div className="text-4xl">📊</div>
      <div className="text-slate-400 font-medium text-sm">ยังไม่มีข้อมูลสำหรับ Ward นี้ในระบบ</div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Compact Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CompactGauge 
          label="Reagent" 
          val={record.reagent} 
          exp={record.reagentExpiry} 
          lot={record.reagentLot}
          color="#0ea5e9"
          icon={<div className="w-2 h-2 rounded-full bg-[#0ea5e9]" />}
        />
        <CompactGauge 
          label="Wash" 
          val={record.wash} 
          exp={record.washExpiry} 
          lot={record.washLot}
          color="#8b5cf6"
          icon={<div className="w-2 h-2 rounded-full bg-[#8b5cf6]" />}
        />
        <CompactGauge 
          label="QC" 
          val={record.qc} 
          exp={record.qcExpiry} 
          lot={record.qcLot}
          color="#10b981"
          icon={<div className="w-2 h-2 rounded-full bg-[#10b981]" />}
        />
      </div>

      {/* Mini Meta Info */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2 text-xs">
          <User size={14} className="text-slate-400" />
          <span className="text-slate-400">ผู้บันทึก:</span>
          <span className="font-bold text-slate-600">{record.worker || '–'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Clock size={14} className="text-slate-400" />
          <span className="text-slate-400">เวลา:</span>
          <span className="font-bold text-slate-600">{fmtDT(record.timestamp)}</span>
        </div>
      </div>

      {/* Refined PM Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={`px-4 py-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${record.deprotein ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className={record.deprotein ? 'text-emerald-500' : 'text-slate-300'} />
            DEPROTEIN
          </div>
          <span className="text-[10px] opacity-60 uppercase">{record.deprotein ? 'Done' : 'Skip'}</span>
        </div>
        <div className={`px-4 py-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${record.condition ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className={record.condition ? 'text-emerald-500' : 'text-slate-300'} />
            CONDITION
          </div>
          <span className="text-[10px] opacity-60 uppercase">{record.condition ? 'Done' : 'Skip'}</span>
        </div>
        <div className={`px-4 py-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${record.waste === 'ทิ้ง Waste' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
          <div className="flex items-center gap-2">
            <Trash2 size={16} className={record.waste === 'ทิ้ง Waste' ? 'text-rose-500' : 'text-slate-300'} />
            WASTE
          </div>
          <span className="text-[10px] opacity-60 uppercase">{record.waste === 'ทิ้ง Waste' ? 'Discarded' : 'Pending'}</span>
        </div>
      </div>

      {record.comment && (
        <div className="bg-amber-50 border-l-2 border-amber-300 p-3 rounded-r-xl">
          <div className="flex gap-2">
            <MessageCircle className="text-amber-500 shrink-0 mt-0.5" size={14} />
            <div className="text-[11px] text-amber-800 leading-relaxed font-medium">
              <span className="font-bold uppercase mr-1">Note:</span> {record.comment}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
