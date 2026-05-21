"use client";

import { motion } from "framer-motion";

interface WardTabsProps {
  wards: string[];
  activeWard: string;
  onSelect: (ward: string) => void;
}

export function WardTabs({ wards, activeWard, onSelect }: WardTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-8 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/60 w-fit">
      {wards.map((ward) => {
        const isActive = activeWard === ward;
        return (
          <button
            key={ward}
            onClick={() => onSelect(ward)}
            className={`relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 outline-none ${
              isActive ? 'text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeWard"
                className="absolute inset-0 bg-gradient-to-r from-sky-600 to-sky-500 rounded-xl shadow-lg shadow-sky-200"
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
