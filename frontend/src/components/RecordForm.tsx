"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Droplets, CheckCircle2, Trash2, Send, MessageCircle, AlertCircle, PenLine, RotateCw } from "lucide-react";

const formSchema = z.object({
  reagent: z.string().min(1, "กรุณากรอกปริมาณ"),
  reagentExpiry: z.string().min(1, "กรุณาเลือกวันหมดอายุ"),
  reagentLot: z.string().min(1, "กรุณากรอก Lot"),
  wash: z.string().min(1, "กรุณากรอกปริมาณ"),
  washExpiry: z.string().min(1, "กรุณาเลือกวันหมดอายุ"),
  washLot: z.string().min(1, "กรุณากรอก Lot"),
  qc: z.string().min(1, "กรุณากรอกปริมาณ"),
  qcExpiry: z.string().min(1, "กรุณาเลือกวันหมดอายุ"),
  qcLot: z.string().min(1, "กรุณากรอก Lot"),
  comment: z.string().optional().or(z.literal("")),
  deprotein: z.boolean(),
  condition: z.boolean(),
  waste: z.enum(["ทิ้ง Waste", "ไม่ได้ทิ้ง Waste"]),
});

type FormValues = z.infer<typeof formSchema>;

interface RecordFormProps {
  ward: string;
  onSuccess: () => void;
  showToast: (msg: string, err?: boolean) => void;
  onValuesChange?: (data: any) => void;
  initialData?: any;
}

export function RecordForm({ ward, onSuccess, showToast, onValuesChange, initialData }: RecordFormProps) {
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // States for toggling "Replace Reagent"
  const [isReplacingR, setIsReplacingR] = useState(false);
  const [isReplacingW, setIsReplacingW] = useState(false);
  const [isReplacingQ, setIsReplacingQ] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reagent: "",
      reagentExpiry: "",
      reagentLot: "",
      wash: "",
      washExpiry: "",
      washLot: "",
      qc: "",
      qcExpiry: "",
      qcLot: "",
      comment: "",
      deprotein: false,
      condition: false,
      waste: "ไม่ได้ทิ้ง Waste",
    },
  });

  // Pre-fill form when initialData (last record) is loaded or changed
  useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        reagent: "", // Clear quantity as it's a daily check
        wash: "",
        qc: "",
        comment: "",
        deprotein: false,
        condition: false,
        waste: "ไม่ได้ทิ้ง Waste",
        reagentLot: initialData.reagentLot || "",
        reagentExpiry: initialData.reagentExpiry || "",
        washLot: initialData.washLot || "",
        washExpiry: initialData.washExpiry || "",
        qcLot: initialData.qcLot || "",
        qcExpiry: initialData.qcExpiry || "",
      });
      // Reset replacement toggles
      setIsReplacingR(false);
      setIsReplacingW(false);
      setIsReplacingQ(false);
    }
  }, [initialData, reset]);

  // Watch all values and send to parent for Live Preview with Debounce
  const watchedValues = watch();
  useEffect(() => {
    if (!onValuesChange) return;

    const timer = setTimeout(() => {
      onValuesChange({
        ...watchedValues,
        reagent: parseFloat(watchedValues.reagent) || 0,
        wash: parseFloat(watchedValues.wash) || 0,
        qc: parseFloat(watchedValues.qc) || 0,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [watchedValues, onValuesChange]);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const res = await api.post("saveRecord", {
        data: {
          ward,
          worker: user?.fullName || user?.username,
          ...data,
          reagent: parseFloat(data.reagent),
          wash: parseFloat(data.wash),
          qc: parseFloat(data.qc),
        },
      });

      if (res.success) {
        showToast("✅ บันทึกสำเร็จ");
        // Clear quantities but keep Lot/Expiry from the record just saved
        setValue("reagent", "");
        setValue("wash", "");
        setValue("qc", "");
        setValue("comment", "");
        setValue("deprotein", false);
        setValue("condition", false);
        setIsReplacingR(false);
        setIsReplacingW(false);
        setIsReplacingQ(false);
        onSuccess();
      } else {
        showToast(res.message || "บันทึกไม่สำเร็จ", true);
      }
    } catch (err) {
      showToast("เชื่อมต่อ API ไม่สำเร็จ", true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const SectionHeader = ({ icon, title, color, isReplacing, onToggleReplace }: { icon: React.ReactNode, title: string, color: string, isReplacing?: boolean, onToggleReplace?: () => void }) => (
    <div className="flex items-center justify-between mb-4 mt-6 first:mt-0">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${color} bg-opacity-10 text-opacity-100`}>
          {icon}
        </div>
        <h3 className="font-bold text-slate-700 text-[11px] uppercase tracking-[0.15em]">{title}</h3>
      </div>
      {onToggleReplace && (
        <motion.button 
          type="button"
          onClick={onToggleReplace}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all duration-500 border ${
            isReplacing 
              ? 'bg-rose-500 border-rose-400 text-white shadow-lg shadow-rose-200' 
              : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-sky-400 hover:bg-white hover:text-sky-600'
          }`}
        >
          <div className="relative w-3.5 h-3.5 flex items-center justify-center">
            <motion.div
              animate={{ 
                rotate: isReplacing ? 360 : 0,
                scale: isReplacing ? 1.2 : 1
              }}
              whileHover={{ rotate: isReplacing ? 450 : 90 }}
              transition={{ 
                rotate: { duration: 0.8, ease: "easeInOut" },
                scale: { type: "spring", stiffness: 200, damping: 15 }
              }}
              className="flex items-center justify-center"
            >
              <RotateCw size={14} className={isReplacing ? "opacity-100" : "opacity-40"} />
            </motion.div>
            {!isReplacing && <PenLine size={10} className="absolute z-10 opacity-60" />}
          </div>
          <span className="ml-1 tracking-tight">{isReplacing ? "กำลังเปลี่ยน..." : "เปลี่ยนน้ำยา"}</span>
        </motion.button>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reagent Section */}
        <div className="space-y-4">
          <SectionHeader 
            icon={<Droplets size={16} />} title="Reagent" color="text-sky-500 bg-sky-500" 
            isReplacing={isReplacingR} onToggleReplace={() => setIsReplacingR(!isReplacingR)}
          />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">ปริมาณ (%)</label>
              <div className="relative">
                <input 
                  type="number" min="0" max="100" 
                  className={`w-full px-4 py-3 rounded-xl border-2 transition-all outline-none font-mono text-base ${errors.wash ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-white focus:border-violet-400'}`}
                  placeholder="0" {...register("wash")} 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
              </div>
            </div>
            <div className={`space-y-3 p-3 rounded-xl border-2 transition-all ${isReplacingR ? 'bg-rose-50/30 border-rose-100' : 'bg-slate-50/50 border-slate-50'}`}>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Lot Number</label>
                <input 
                  type="text" 
                  readOnly={!isReplacingR}
                  placeholder="ยังไม่มีข้อมูล Lot"
                  className={`w-full px-3 py-2 rounded-lg border transition-all outline-none text-sm font-bold ${isReplacingR ? 'bg-white border-rose-200 focus:border-rose-400 text-slate-700' : 'bg-transparent border-transparent text-slate-400'}`}
                  {...register("reagentLot")} 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">วันหมดอายุ</label>
                <input 
                  type="date" 
                  readOnly={!isReplacingR}
                  className={`w-full px-3 py-2 rounded-lg border transition-all outline-none text-sm font-bold ${isReplacingR ? 'bg-white border-rose-200 focus:border-rose-400 text-slate-700' : 'bg-transparent border-transparent text-slate-400'}`}
                  {...register("reagentExpiry")} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Wash Section */}
        <div className="space-y-4">
          <SectionHeader 
            icon={<Droplets size={16} />} title="Wash" color="text-violet-500 bg-violet-500" 
            isReplacing={isReplacingW} onToggleReplace={() => setIsReplacingW(!isReplacingW)}
          />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">ปริมาณ (%)</label>
              <div className="relative">
                <input 
                  type="number" min="0" max="100" 
                  className={`w-full px-4 py-3 rounded-xl border-2 transition-all outline-none font-mono text-base ${errors.wash ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-white focus:border-violet-400'}`}
                  placeholder="0" {...register("wash")} 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
              </div>
            </div>
            <div className={`space-y-3 p-3 rounded-xl border-2 transition-all ${isReplacingW ? 'bg-rose-50/30 border-rose-100' : 'bg-slate-50/50 border-slate-50'}`}>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Lot Number</label>
                <input 
                  type="text" 
                  readOnly={!isReplacingW}
                  placeholder="ยังไม่มีข้อมูล Lot"
                  className={`w-full px-3 py-2 rounded-lg border transition-all outline-none text-sm font-bold ${isReplacingW ? 'bg-white border-rose-200 focus:border-rose-400 text-slate-700' : 'bg-transparent border-transparent text-slate-400'}`}
                  {...register("washLot")} 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">วันหมดอายุ</label>
                <input 
                  type="date" 
                  readOnly={!isReplacingW}
                  className={`w-full px-3 py-2 rounded-lg border transition-all outline-none text-sm font-bold ${isReplacingW ? 'bg-white border-rose-200 focus:border-rose-400 text-slate-700' : 'bg-transparent border-transparent text-slate-400'}`}
                  {...register("washExpiry")} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* QC Section */}
        <div className="space-y-4">
          <SectionHeader 
            icon={<Droplets size={16} />} title="QC" color="text-emerald-500 bg-emerald-500" 
            isReplacing={isReplacingQ} onToggleReplace={() => setIsReplacingQ(!isReplacingQ)}
          />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">ปริมาณ (%)</label>
              <div className="relative">
                <input 
                  type="number" min="0" max="100" 
                  className={`w-full px-4 py-3 rounded-xl border-2 transition-all outline-none font-mono text-base ${errors.wash ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-white focus:border-violet-400'}`}
                  placeholder="0" {...register("wash")} 
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
              </div>
            </div>
            <div className={`space-y-3 p-3 rounded-xl border-2 transition-all ${isReplacingQ ? 'bg-rose-50/30 border-rose-100' : 'bg-slate-50/50 border-slate-50'}`}>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Lot Number</label>
                <input 
                  type="text" 
                  readOnly={!isReplacingQ}
                  placeholder="ยังไม่มีข้อมูล Lot"
                  className={`w-full px-3 py-2 rounded-lg border transition-all outline-none text-sm font-bold ${isReplacingQ ? 'bg-white border-rose-200 focus:border-rose-400 text-slate-700' : 'bg-transparent border-transparent text-slate-400'}`}
                  {...register("qcLot")} 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">วันหมดอายุ</label>
                <input 
                  type="date" 
                  readOnly={!isReplacingQ}
                  className={`w-full px-3 py-2 rounded-lg border transition-all outline-none text-sm font-bold ${isReplacingQ ? 'bg-white border-rose-200 focus:border-rose-400 text-slate-700' : 'bg-transparent border-transparent text-slate-400'}`}
                  {...register("qcExpiry")} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader icon={<CheckCircle2 size={16} />} title="Preventive Maintenance & Waste" color="text-slate-500 bg-slate-500" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-4">
            <motion.label 
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.96 }}
              className={`group cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3 shadow-sm ${watch("deprotein") ? 'border-emerald-400 bg-emerald-50 shadow-emerald-100' : 'border-slate-100 bg-white hover:border-slate-200'}`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${watch("deprotein") ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
                <CheckCircle2 size={14} />
              </div>
              <input type="checkbox" className="sr-only" {...register("deprotein")} />
              <div className="text-sm font-bold text-slate-700 uppercase tracking-tight">Deprotein</div>
            </motion.label>

            <motion.label 
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.96 }}
              className={`group cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center gap-3 shadow-sm ${watch("condition") ? 'border-emerald-400 bg-emerald-50 shadow-emerald-100' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${watch("condition") ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
                <CheckCircle2 size={14} />
              </div>
              <input type="checkbox" className="sr-only" {...register("condition")} />
              <div className="text-sm font-bold text-slate-700 uppercase tracking-tight">Condition</div>
            </motion.label>
          </div>

          <motion.label 
            whileHover={{ scale: 1.01, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`group cursor-pointer p-4 rounded-2xl border-2 transition-all flex items-center justify-between shadow-sm relative overflow-hidden ${watch("waste") === "ทิ้ง Waste" ? 'border-rose-400 bg-rose-50 shadow-rose-100' : 'border-slate-100 bg-white hover:border-slate-200'}`}
          >
            <div className="flex items-center gap-4 relative z-10">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${watch("waste") === "ทิ้ง Waste" ? 'bg-rose-500 text-white rotate-12' : 'bg-slate-100 text-slate-400'}`}>
                <Trash2 size={20} />
              </div>
              <div>
                <div className={`text-sm font-bold transition-colors ${watch("waste") === "ทิ้ง Waste" ? 'text-rose-700' : 'text-slate-700'}`}>
                  {watch("waste") === "ทิ้ง Waste" ? "นำของเสียไปทิ้งแล้ว" : "ตรวจสอบถังของเสีย (Waste)"}
                </div>
                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  {watch("waste") === "ทิ้ง Waste" ? "Discarded Successfully" : "Click to mark as discarded"}
                </div>
              </div>
            </div>
            
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${watch("waste") === "ทิ้ง Waste" ? 'bg-rose-500 border-rose-500 scale-110' : 'border-slate-200 bg-transparent'}`}>
              {watch("waste") === "ทิ้ง Waste" && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>

            <input 
              type="checkbox" 
              className="sr-only" 
              checked={watch("waste") === "ทิ้ง Waste"}
              onChange={(e) => setValue("waste", e.target.checked ? "ทิ้ง Waste" : "ไม่ได้ทิ้ง Waste", { shouldDirty: true })}
            />

            {/* Subtle background icon */}
            <Trash2 size={80} className={`absolute right-[-10px] bottom-[-10px] transition-all ${watch("waste") === "ทิ้ง Waste" ? 'text-rose-500/10 rotate-0' : 'text-slate-500/5 rotate-12'}`} />
          </motion.label>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader icon={<MessageCircle size={16} />} title="Handover Note" color="text-amber-500 bg-amber-500" />
        <textarea 
          placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)..." 
          className="w-full px-4 py-4 rounded-2xl border-2 border-slate-100 bg-white focus:border-amber-400 focus:shadow-lg focus:shadow-amber-100 outline-none min-h-[100px] text-base leading-relaxed transition-all"
          {...register("comment")}
        />
      </div>

      <motion.button 
        whileHover={{ 
          scale: 1.02,
          boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
          backgroundColor: "#088395"
        }}
        whileTap={{ scale: 0.97 }}
        type="submit" 
        disabled={isSubmitting}
        className="w-full bg-[#0a4d68] text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-sky-900/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        {isSubmitting ? (
          <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Send size={22} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
        )}
        <span className="relative z-10">
          {isSubmitting ? "⏳ กำลังบันทึกข้อมูล…" : "💾 บันทึกข้อมูลลงในระบบ"}
        </span>
      </motion.button>
    </form>
  );
}
