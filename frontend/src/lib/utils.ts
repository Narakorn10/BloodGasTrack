import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtD(ds: string) {
  if (!ds) return "–";
  const d = new Date(ds);
  return isNaN(d.getTime()) ? ds : d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDT(ds: string) {
  if (!ds) return "–";
  const d = new Date(ds);
  return isNaN(d.getTime()) ? ds : d.toLocaleString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
