"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { RecordForm } from "@/components/RecordForm";
import { WardTabs } from "@/components/WardTabs";
import { DashboardSummary } from "@/components/DashboardSummary";
import { LogsList } from "@/components/LogsList";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, PenLine, History, AlertCircle } from "lucide-react";

// Final Build Trigger: Correcting TypeScript onSuccess signature
export default function DashboardPage() {
  const [ward, setWard] = useState("");
  const [wards, setWards] = useState<string[]>([]);
  const [record, setRecord] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);

  const fetchData = useCallback(async (currentWard: string) => {
    if (!currentWard) return;
    setLoading(true);
    setPreviewData(null); 
    try {
      const [recRes, logRes] = await Promise.all([
        api.post("getLastRecord", { ward: currentWard }),
        api.post("getLogs", { ward: currentWard })
      ]);
      setRecord(recRes.record);
      setLogs(logRes.logs || []);
    } catch (err) {
      showToast("❌ โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่", true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const savedUserStr = localStorage.getItem("user");
      if (!savedUserStr) return;
      const user = JSON.parse(savedUserStr);

      try {
        const wardRes = await api.post("getWards");
        let availableWards = wardRes.wards || ["อายุกรรมชาย 2", "NICU", "ICU(MED)"];
        
        if (user.role !== 'admin' && user.ward) {
          availableWards = [user.ward];
          setWard(user.ward);
        } else {
          setWards(availableWards);
          setWard(availableWards[0]);
        }
        setWards(availableWards);
      } catch (err) {
        console.error("Failed to load wards");
        setWards(["อายุกรรมชาย 2", "NICU", "ICU(MED)"]);
        setWard("อายุกรรมชาย 2");
      } finally {
        // Ensure loading is handled if initial fetch is quick
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (ward) fetchData(ward);
    else setLoading(false); // Stop loading if no ward to fetch
  }, [ward, fetchData]);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3500);
  };

  // Merge live form data with current record for preview
  const displayRecord = previewData ? { ...record, ...previewData } : record;
  const isMock = !process.env.NEXT_PUBLIC_GAS_URL;

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {isMock && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] font-bold text-amber-700 flex items-center gap-2">
          <AlertCircle size={14} /> ระบบกำลังทำงานในโหมดจำลอง (Mock Data) เนื่องจากยังไม่ได้ตั้งค่า NEXT_PUBLIC_GAS_URL ใน Vercel
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <WardTabs wards={wards} activeWard={ward} onSelect={setWard} />
      </motion.div>

      <div className="space-y-6">
        {/* Dashboard Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
              <LayoutDashboard size={12} /> แผงควบคุมสถานะปัจจุบัน
            </div>
            {previewData && (
              <div className="flex items-center gap-1 text-sky-500 font-bold text-[9px] uppercase animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" /> กำลังแก้ไข (Preview)
              </div>
            )}
          </div>
          <div className="bg-white rounded-[1.5rem] p-4 sm:p-6 border border-slate-200 shadow-sm relative overflow-hidden">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
                <div className="w-10 h-10 border-4 border-slate-100 border-t-sky-500 rounded-full animate-spin" />
                <p className="font-medium">กำลังดึงข้อมูลล่าสุด...</p>
              </div>
            ) : (
              <DashboardSummary record={displayRecord} />
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
          {/* Form Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest px-1">
              <PenLine size={14} /> แบบฟอร์มบันทึกน้ำยา
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

          {/* History Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest px-1">
              <History size={14} /> ประวัติการบันทึก 20 รายการล่าสุด
            </div>
            <div className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-200/60 max-h-[1000px] overflow-y-auto custom-scrollbar">
              <LogsList logs={logs} />
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className={`toast on ${toast.err ? 'err' : ''}`}
          >
            {toast.err ? <AlertCircle size={20} /> : <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px]">✓</div>}
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
