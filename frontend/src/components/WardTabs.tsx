"use client";

import { motion } from "framer-motion";

interface WardTabsProps {
  wards: string[];
  activeWard: string;
  onSelect: (ward: string) => void;
}

export function WardTabs({ wards, activeWard, onSelect }: WardTabsProps) {
  return (
    <div className="flex overflow-x-auto no-scrollbar gap-2 mb-8 bg-slate-100/50 p-2 rounded-[2rem] border border-slate-200/60 w-full max-w-full">
      {wards.map((ward) => {
        const isActive = activeWard === ward;
        return (
          <button
            key={ward}
            onClick={() => onSelect(ward)}
            className={`relative shrink-0 px-8 py-4 rounded-[1.5rem] text-base font-extrabold transition-all duration-200 outline-none active:scale-95 touch-manipulation whitespace-nowrap ${
              isActive ? 'text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-white/80 active:bg-slate-200 shadow-sm'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeWard"
                className="absolute inset-0 bg-gradient-to-r from-[#0a4d68] to-[#088395] rounded-[1.5rem] shadow-lg shadow-sky-900/20"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">{ward}</span>
          </button>
        );
      })}
    </div>
  );
}
