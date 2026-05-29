"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import { Droplets, CheckCircle2, Trash2, Send, MessageCircle, PenLine, RotateCw } from "lucide-react";

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

interface User {
  username: string;
  fullName: string;
  role: string;
}

interface BloodGasRecord {
  reagent: number;
  reagentExpiry: string;
  reagentLot: string;
  wash: number;
  washExpiry: string;
  washLot: string;
  qc: number;
  qcExpiry: string;
  qcLot: string;
  worker: string;
  timestamp: string;
  deprotein: boolean;
  condition: boolean;
  waste: string;
  comment: string;
}

interface RecordFormProps {
  ward: string;
  onSuccess: () => void;
  showToast: (msg: string, err?: boolean) => void;
  onValuesChange?: (data: Partial<BloodGasRecord>) => void;
  initialData?: BloodGasRecord | null;
}

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  color: string;
  isReplacing?: boolean;
  onToggleReplace?: () => void;
}

const SectionHeader = ({ icon, title, color, isReplacing, onToggleReplace }: SectionHeaderProps) => (
  <div className="flex items-center justify-between mb-4 mt-6 first:mt-0">
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-lg ${color} bg-opacity-10 text-opacity-100`}>
        {icon}
      </div>
      <h3 className="font-bold text-slate-700 text-[11px] uppercase tracking-[0.15em]">{title}</h3>
    </div>
    {onToggleReplace && (
      <button 
        type="button"
        onClick={onToggleReplace}
        className={`flex items-center gap-2 px-6 py-3.5 rounded-full text-[11px] font-extrabold transition-all duration-150 border active:scale-[0.97] touch-manipulation shadow-sm ${
          isReplacing 
            ? 'bg-rose-500 border-rose-400 text-white shadow-rose-200' 
            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 active:bg-slate-100'
        }`}
      >
        {isReplacing ? <RotateCw size={14} className="animate-spin-slow" /> : <PenLine size={14} />}
        <span className="ml-1 tracking-tight">{isReplacing ? "ยกเลิก" : "เปลี่ยนน้ำยา"}</span>
      </button>

    )}
  </div>
);

export function RecordForm({ ward, onSuccess, showToast, onValuesChange, initialData }: RecordFormProps) {
  const [user, setUser] = useState<User | null>(null);
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
    formState: { errors },
  } = useForm<FormValues>({
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
      setIsReplacingR(false);
      setIsReplacingW(false);
      setIsReplacingQ(false);
    } else {
      reset({
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
      });
      // Force replace mode if no initial data so user can type
      setIsReplacingR(true);
      setIsReplacingW(true);
      setIsReplacingQ(true);
    }
  }, [initialData, reset]);

  // Watch all values and send to parent for Live Preview with Debounce
  const watchedValues = watch();
  const lastUpdateRef = useRef<string>("");

  useEffect(() => {
    if (!onValuesChange) return;
    
    // Create a stable representation of the data to check for changes
    const currentData = {
      ...watchedValues,
      reagent: parseFloat(watchedValues.reagent) || 0,
      wash: parseFloat(watchedValues.wash) || 0,
      qc: parseFloat(watchedValues.qc) || 0,
    };
    
    const dataString = JSON.stringify(currentData);
    
    // If nothing changed, don't trigger update
    if (dataString === lastUpdateRef.current) return;

    const timer = setTimeout(() => {
      lastUpdateRef.current = dataString;
      onValuesChange(currentData);
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
          ...data,
          ward: ward,
          worker: user?.fullName || user?.username,
          reagent: parseFloat(data.reagent),
          wash: parseFloat(data.wash),
          qc: parseFloat(data.qc),
        },
      });

      if (res.success) {
        showToast("✅ บันทึกสำเร็จ");
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
    } catch {
      showToast("เชื่อมต่อ API ไม่สำเร็จ", true);
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <label className="text-xs font-bold text-slate-500 ml-1">ปริมาณ (%)</label>
              <div className="relative group">
                <input 
                  type="number" min="0" max="100" 
                  className={`w-full px-5 py-4 rounded-2xl border-2 transition-all outline-none font-mono text-lg ${errors.reagent ? 'border-red-400 bg-red-50' : 'border-slate-100 bg-white focus:border-sky-400 focus:ring-4 focus:ring-sky-50'}`}
                  placeholder="0" {...register("reagent")} 
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
              </div>
              {errors.reagent && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.reagent.message}</p>}
            </div>
            <div className={`space-y-3 p-4 rounded-2xl border-2 transition-all ${isReplacingR ? 'bg-rose-50/40 border-rose-100' : 'bg-slate-50/50 border-slate-50'}`}>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">Lot Number</label>
                <input 
                  type="text" 
                  readOnly={!isReplacingR}
                  placeholder="กรอก Lot Number"
                  className={`w-full px-4 py-2.5 rounded-xl border transition-all outline-none text-sm font-bold ${isReplacingR ? 'bg-white border-rose-200 focus:border-rose-400 text-slate-700 shadow-inner' : 'bg-transparent border-transparent text-slate-400'}`}
                  {...register("reagentLot")} 
                />
                {errors.reagentLot && <p className="text-[9px] text-red-500 font-bold ml-1">{errors.reagentLot.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">วันหมดอายุ</label>
                <input 
                  type="date" 
                  readOnly={!isReplacingR}
                  className={`w-full px-4 py-2.5 rounded-xl border transition-all outline-none text-sm font-bold ${isReplacingR ? 'bg-white border-rose-200 focus:border-rose-400 text-slate-700 shadow-inner' : 'bg-transparent border-transparent text-slate-400'}`}
                  {...register("reagentExpiry")} 
                />
                {errors.reagentExpiry && <p className="text-[9px] text-red-500 font-bold ml-1">{errors.reagentExpiry.message}</p>}
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
              <label className="text-xs font-bold text-slate-500 ml-1">ปริมาณ (%)</label>
              <div className="relative group">
                <input 
                  type="number" min="0" max="100" 
                  className={`w-full px-5 py-4 rounded-2xl border-2 transition-all outline-none font-mono text-lg ${errors.wash ? 'border-red-400 bg-red-50' : 'border-slate-100 bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-50'}`}
                  placeholder="0" {...register("wash")} 
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
              </div>
              {errors.wash && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.wash.message}</p>}
            </div>
            <div className={`space-y-3 p-4 rounded-2xl border-2 transition-all ${isReplacingW ? 'bg-rose-50/40 border-rose-100' : 'bg-slate-50/50 border-slate-50'}`}>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">Lot Number</label>
                <input 
                  type="text" 
                  readOnly={!isReplacingW}
                  placeholder="กรอก Lot Number"
                  className={`w-full px-4 py-2.5 rounded-xl border transition-all outline-none text-sm font-bold ${isReplacingW ? 'bg-white border-rose-200 focus:border-rose-400 text-slate-700 shadow-inner' : 'bg-transparent border-transparent text-slate-400'}`}
                  {...register("washLot")} 
                />
                {errors.washLot && <p className="text-[9px] text-red-500 font-bold ml-1">{errors.washLot.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">วันหมดอายุ</label>
                <input 
                  type="date" 
                  readOnly={!isReplacingW}
                  className={`w-full px-4 py-2.5 rounded-xl border transition-all outline-none text-sm font-bold ${isReplacingW ? 'bg-white border-rose-200 focus:border-rose-400 text-slate-700 shadow-inner' : 'bg-transparent border-transparent text-slate-400'}`}
                  {...register("washExpiry")} 
                />
                {errors.washExpiry && <p className="text-[9px] text-red-500 font-bold ml-1">{errors.washExpiry.message}</p>}
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
              <label className="text-xs font-bold text-slate-500 ml-1">ปริมาณ (%)</label>
              <div className="relative group">
                <input 
                  type="number" min="0" max="100" 
                  className={`w-full px-5 py-4 rounded-2xl border-2 transition-all outline-none font-mono text-lg ${errors.qc ? 'border-red-400 bg-red-50' : 'border-slate-100 bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50'}`}
                  placeholder="0" {...register("qc")} 
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
              </div>
              {errors.qc && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.qc.message}</p>}
            </div>
            <div className={`space-y-3 p-4 rounded-2xl border-2 transition-all ${isReplacingQ ? 'bg-rose-50/40 border-rose-100' : 'bg-slate-50/50 border-slate-50'}`}>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">Lot Number</label>
                <input 
                  type="text" 
                  readOnly={!isReplacingQ}
                  placeholder="กรอก Lot Number"
                  className={`w-full px-4 py-2.5 rounded-xl border transition-all outline-none text-sm font-bold ${isReplacingQ ? 'bg-white border-rose-200 focus:border-rose-400 text-slate-700 shadow-inner' : 'bg-transparent border-transparent text-slate-400'}`}
                  {...register("qcLot")} 
                />
                {errors.qcLot && <p className="text-[9px] text-red-500 font-bold ml-1">{errors.qcLot.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">วันหมดอายุ</label>
                <input 
                  type="date" 
                  readOnly={!isReplacingQ}
                  className={`w-full px-4 py-2.5 rounded-xl border transition-all outline-none text-sm font-bold ${isReplacingQ ? 'bg-white border-rose-200 focus:border-rose-400 text-slate-700 shadow-inner' : 'bg-transparent border-transparent text-slate-400'}`}
                  {...register("qcExpiry")} 
                />
                {errors.qcExpiry && <p className="text-[9px] text-red-500 font-bold ml-1">{errors.qcExpiry.message}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader icon={<CheckCircle2 size={16} />} title="Preventive Maintenance & Waste" color="text-slate-500 bg-slate-500" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid grid-cols-2 gap-4">
            <button 
              type="button"
              onClick={() => setValue("deprotein", !watch("deprotein"), { shouldDirty: true })}
              className={`group cursor-pointer p-6 rounded-[1.5rem] border-2 transition-all flex items-center gap-3 active:scale-[0.97] touch-manipulation ${watch("deprotein") ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100' : 'border-slate-100 bg-white hover:border-slate-200'}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${watch("deprotein") ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
                <CheckCircle2 size={18} />
              </div>
              <div className="text-xs font-extrabold text-slate-700 uppercase tracking-tight">Deprotein</div>
            </button>

            <button 
              type="button"
              onClick={() => setValue("condition", !watch("condition"), { shouldDirty: true })}
              className={`group cursor-pointer p-6 rounded-[1.5rem] border-2 transition-all flex items-center gap-3 active:scale-[0.97] touch-manipulation ${watch("condition") ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${watch("condition") ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
                <CheckCircle2 size={18} />
              </div>
              <div className="text-xs font-extrabold text-slate-700 uppercase tracking-tight">Condition</div>
            </button>
          </div>

          <button 
            type="button"
            onClick={() => setValue("waste", watch("waste") === "ทิ้ง Waste" ? "ไม่ได้ทิ้ง Waste" : "ทิ้ง Waste", { shouldDirty: true })}
            className={`group cursor-pointer p-6 rounded-[1.5rem] border-2 transition-all flex items-center justify-between active:scale-[0.97] touch-manipulation relative overflow-hidden ${watch("waste") === "ทิ้ง Waste" ? 'border-rose-400 bg-rose-50 shadow-md shadow-rose-100' : 'border-slate-100 bg-white hover:border-slate-200'}`}
          >
            <div className="flex items-center gap-4 relative z-10">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${watch("waste") === "ทิ้ง Waste" ? 'bg-rose-500 text-white rotate-12' : 'bg-slate-100 text-slate-400'}`}>
                <Trash2 size={24} />
              </div>
              <div className="text-left">
                <div className={`text-sm font-extrabold transition-colors ${watch("waste") === "ทิ้ง Waste" ? 'text-rose-700' : 'text-slate-700'}`}>
                  {watch("waste") === "ทิ้ง Waste" ? "นำของเสียไปทิ้งแล้ว" : "ตรวจสอบถังของเสีย (Waste)"}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {watch("waste") === "ทิ้ง Waste" ? "Discarded Successfully" : "Click to mark as discarded"}
                </div>
              </div>
            </div>
            
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${watch("waste") === "ทิ้ง Waste" ? 'bg-rose-500 border-rose-500 scale-110' : 'border-slate-200 bg-transparent'}`}>
              {watch("waste") === "ทิ้ง Waste" && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader icon={<MessageCircle size={16} />} title="Handover Note" color="text-amber-500 bg-amber-500" />
        <textarea 
          placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)..." 
          className="w-full px-6 py-6 rounded-[1.5rem] border-2 border-slate-100 bg-white focus:border-amber-400 focus:shadow-xl focus:shadow-amber-100 outline-none min-h-[140px] text-base leading-relaxed transition-all shadow-sm"
          {...register("comment")}
        />
      </div>

      <button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full bg-[#0a4d68] active:bg-[#088395] text-white py-6 rounded-[2.5rem] font-extrabold text-xl shadow-xl shadow-sky-900/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99] touch-manipulation group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        {isSubmitting ? (
          <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
        )}
        <span className="relative z-10 tracking-tight">
          {isSubmitting ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
        </span>
      </button>
    </form>
  );
}
