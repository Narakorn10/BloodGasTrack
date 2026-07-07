"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { RecordForm } from "@/components/RecordForm";
import { WardTabs } from "@/components/WardTabs";
import { DashboardSummary } from "@/components/DashboardSummary";
import { LogsList } from "@/components/LogsList";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, PenLine, History, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { BloodGasRecord, User } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [ward, setWard] = useState("");
  const [wards, setWards] = useState<string[]>([]);
  const [record, setRecord] = useState<BloodGasRecord | null>(null);
  const [previewData, setPreviewData] = useState<Partial<BloodGasRecord> | null>(null);
  const [logs, setLogs] = useState<BloodGasRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // We'll use this ref to check ward changes without triggering dependency loops in fetchData
  const lastWardRef = useRef("");

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async (targetWard: string) => {
    if (!targetWard) return;
    
    // If switching to a NEW ward, show full loading. If updating SAME ward, show refreshing.
    if (lastWardRef.current !== targetWard) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    
    setPreviewData(null); 
    try {
      const [recRes, logRes] = await Promise.all([
        api.post("getLastRecord", { ward: targetWard }),
        api.post("getLogs", { ward: targetWard })
      ]);
      
      setRecord(recRes.record);
      setLogs(logRes.logs || []);
      lastWardRef.current = targetWard;
    } catch {
      showToast("❌ การดึงข้อมูลผิดพลาด", true);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []); // Correctly breaks the infinite loop

  // Initialization: Load User and Wards
  useEffect(() => {
    const init = async () => {
      const savedUserStr = localStorage.getItem("user");
      if (!savedUserStr) {
        router.replace("/login");
        setLoading(false);
        return;
      }
      const loggedUser = JSON.parse(savedUserStr);
      setUser(loggedUser);

      let availableWards: string[] = [];
      try {
        const wardRes = await api.post("getWards");
        availableWards = wardRes.wards || [];

        if (loggedUser.role !== 'admin' && loggedUser.ward) {
          setWards([loggedUser.ward]);
          setWard(loggedUser.ward);
        } else {
          setWards(availableWards);
          setWard(availableWards[0] || "");
        }
      } catch (err) {
        console.error("Init Error:", err);
        const fallbackWards = loggedUser.ward ? [loggedUser.ward] : [];
        setWards(fallbackWards);
        setWard(fallbackWards[0] || "");
        showToast("โหลดรายชื่อหอผู้ป่วยไม่สำเร็จ กำลังใช้ข้อมูลล่าสุดที่มี", true);
      } finally {
        const firstWard =
          loggedUser.role !== 'admin'
            ? loggedUser.ward
            : availableWards[0] || loggedUser.ward || "";
        if (!firstWard) setLoading(false);
      }
    };
    init();
  }, [router]);

  // Fetch data whenever selected ward changes
  useEffect(() => {
    let isMounted = true;
    
    const triggerFetch = async () => {
      if (ward) {
        await fetchData(ward);
      } else if (user && isMounted) {
        setLoading(false);
      }
    };

    triggerFetch();
    
    return () => { isMounted = false; };
  }, [ward, fetchData, user]);

  const displayRecord = previewData ? { ...record, ...previewData } : record;
  const isMock = typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_GAS_URL;

  if (!user && !loading) return null;

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {isMock && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] font-bold text-amber-700 flex items-center gap-3 shadow-sm">
          <AlertCircle size={16} /> ระบบกำลังทำงานในโหมดจำลอง (Mock Data) กรุณาตั้งค่า NEXT_PUBLIC_GAS_URL ใน Vercel
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        {wards.length > 0 && (
          <div className="mb-4">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              หอผู้ป่วย
            </label>
            <select
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm outline-none transition focus:border-sky-400"
            >
              {wards.map((wardName) => (
                <option key={wardName} value={wardName}>
                  {wardName}
                </option>
              ))}
            </select>
          </div>
        )}
        <WardTabs wards={wards} activeWard={ward} onSelect={setWard} />
      </motion.div>

      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
              <LayoutDashboard size={12} /> สถานะปัจจุบันของ {ward}
            </div>
            {(previewData || isRefreshing) && (
              <div className="flex items-center gap-1.5 text-sky-500 font-bold text-[9px] uppercase animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> 
                {isRefreshing ? 'กำลังอัปเดตข้อมูล...' : 'กำลังทำรายการ (Preview)'}
              </div>
            )}
          </div>
          <div className="bg-white rounded-[2rem] p-6 sm:p-10 border border-slate-200 shadow-xl shadow-slate-200/50 relative overflow-hidden transition-all duration-500">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-5 text-slate-300">
                <div className="w-10 h-10 border-4 border-slate-100 border-t-[#0a4d68] rounded-full animate-spin" />
                <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-slate-400">Loading Ward Data...</p>
              </div>
            ) : (
              <div className={`transition-opacity duration-300 ${isRefreshing ? 'opacity-40 grayscale-[50%]' : 'opacity-100'}`}>
                <DashboardSummary record={displayRecord} />
              </div>
            )}
            
            {isRefreshing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-full border border-slate-200 shadow-2xl flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Refreshing</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest px-1">
              <PenLine size={14} /> บันทึกข้อมูลน้ำยา
            </div>
            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
              <RecordForm 
                ward={ward} 
                onSuccess={() => fetchData(ward)} 
                showToast={showToast} 
                onValuesChange={setPreviewData}
                initialData={record}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest px-1">
              <History size={14} /> ประวัติการทำงาน
            </div>
            <div className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-200/60 max-h-[800px] overflow-y-auto custom-scrollbar no-scrollbar sm:block">
              <LogsList logs={logs} />
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 20, x: "-50%" }} className={`toast on ${toast.err ? 'err' : ''}`}>
            {toast.err ? <AlertCircle size={20} /> : <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px]">✓</div>}
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
