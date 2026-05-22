"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { RecordForm } from "@/components/RecordForm";
import { WardTabs } from "@/components/WardTabs";
import { DashboardSummary } from "@/components/DashboardSummary";
import { LogsList } from "@/components/LogsList";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, PenLine, History, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const [ward, setWard] = useState("");
  const [wards, setWards] = useState<string[]>([]);
  const [record, setRecord] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [user, setUser] = useState<any>(null);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async (targetWard: string) => {
    if (!targetWard) return;
    setLoading(true);
    setPreviewData(null); 
    try {
      const [recRes, logRes] = await Promise.all([
        api.post("getLastRecord", { ward: targetWard }),
        api.post("getLogs", { ward: targetWard })
      ]);
      setRecord(recRes.record);
      setLogs(logRes.logs || []);
    } catch (err) {
      showToast("❌ การดึงข้อมูลผิดพลาด", true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialization: Load User and Wards
  useEffect(() => {
    const init = async () => {
      const savedUserStr = localStorage.getItem("user");
      if (!savedUserStr) return;
      const loggedUser = JSON.parse(savedUserStr);
      setUser(loggedUser);

      try {
        const wardRes = await api.post("getWards");
        const availableWards: string[] = wardRes.wards || [];
        
        if (loggedUser.role !== 'admin' && loggedUser.ward) {
          // User: Restricted to their ward
          setWards([loggedUser.ward]);
          setWard(loggedUser.ward);
        } else {
          // Admin: Can see everything
          setWards(availableWards);
          setWard(availableWards[0] || "");
        }
      } catch (err) {
        console.error("Init Error:", err);
        setLoading(false);
      }
    };
    init();
  }, []);

  // Fetch data whenever selected ward changes
  useEffect(() => {
    if (ward) fetchData(ward);
    else if (user) setLoading(false);
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
        <WardTabs wards={wards} activeWard={ward} onSelect={setWard} />
      </motion.div>

      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
              <LayoutDashboard size={12} /> สถานะปัจจุบันของ {ward}
            </div>
            {previewData && (
              <div className="flex items-center gap-1.5 text-sky-500 font-bold text-[9px] uppercase animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> กำลังทำรายการ (Preview)
              </div>
            )}
          </div>
          <div className="bg-white rounded-[1.5rem] p-5 sm:p-7 border border-slate-200 shadow-sm relative overflow-hidden">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-4 text-slate-300">
                <div className="w-8 h-8 border-3 border-slate-100 border-t-sky-500 rounded-full animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest">Loading Data...</p>
              </div>
            ) : (
              <DashboardSummary record={displayRecord} />
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
