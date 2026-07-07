"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CheckCircle2, Droplets, MessageCircle, Send, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

const wasteOptions = ["ทิ้ง Waste", "ไม่ได้ทิ้ง Waste"] as const;

const formSchema = z.object({
  reagent: z.string().optional().or(z.literal("")),
  reagentExpiry: z.string().optional().or(z.literal("")),
  reagentLot: z.string().optional().or(z.literal("")),
  reagentPackChanged: z.boolean(),
  wash: z.string().optional().or(z.literal("")),
  washExpiry: z.string().optional().or(z.literal("")),
  washLot: z.string().optional().or(z.literal("")),
  washPackChanged: z.boolean(),
  qc: z.string().optional().or(z.literal("")),
  qcExpiry: z.string().optional().or(z.literal("")),
  qcLot: z.string().optional().or(z.literal("")),
  qcPackChanged: z.boolean(),
  comment: z.string().optional().or(z.literal("")),
  deprotein: z.boolean(),
  condition: z.boolean(),
  waste: z.enum(wasteOptions),
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
  reagentPackChanged?: boolean;
  wash: number;
  washExpiry: string;
  washLot: string;
  washPackChanged?: boolean;
  qc: number;
  qcExpiry: string;
  qcLot: string;
  qcPackChanged?: boolean;
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
}

interface PackChangeCheckboxProps {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

interface ReagentSectionProps {
  title: string;
  quantityField: "reagent" | "wash" | "qc";
  lotField: "reagentLot" | "washLot" | "qcLot";
  expiryField: "reagentExpiry" | "washExpiry" | "qcExpiry";
  packChangedField: "reagentPackChanged" | "washPackChanged" | "qcPackChanged";
  quantityError?: string;
  lotError?: string;
  expiryError?: string;
  colorClasses: {
    icon: string;
    focusBorder: string;
    focusRing: string;
  };
  register: ReturnType<typeof useForm<FormValues>>["register"];
  packChanged: boolean;
  setValue: ReturnType<typeof useForm<FormValues>>["setValue"];
}

const SectionHeader = ({ icon, title, color }: SectionHeaderProps) => (
  <div className="mb-4 mt-6 flex items-center justify-between first:mt-0">
    <div className="flex items-center gap-2">
      <div className={`rounded-lg p-1.5 ${color} bg-opacity-10 text-opacity-100`}>{icon}</div>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-700">{title}</h3>
    </div>
  </div>
);

const PackChangeCheckbox = ({ checked, label, onChange }: PackChangeCheckboxProps) => (
  <label
    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
      checked
        ? "border-rose-300 bg-rose-50 text-rose-700 shadow-sm"
        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
    }`}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-slate-300 text-rose-500 focus:ring-rose-300"
    />
    <span>{label}</span>
  </label>
);

function ReagentSection({
  title,
  quantityField,
  lotField,
  expiryField,
  packChangedField,
  quantityError,
  lotError,
  expiryError,
  colorClasses,
  register,
  packChanged,
  setValue,
}: ReagentSectionProps) {
  return (
    <div className="space-y-4">
      <SectionHeader icon={<Droplets size={16} />} title={title} color={colorClasses.icon} />
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="ml-1 text-xs font-bold text-slate-500">ปริมาณ (%)</label>
          <div className="relative group">
            <input
              type="number"
              min="0"
              max="100"
              placeholder="0"
              className={`w-full rounded-2xl border-2 px-5 py-4 font-mono text-lg outline-none transition-all ${
                quantityError
                  ? "border-red-400 bg-red-50"
                  : `border-slate-100 bg-white ${colorClasses.focusBorder} ${colorClasses.focusRing}`
              }`}
              {...register(quantityField)}
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
          </div>
          {quantityError && <p className="ml-1 text-[10px] font-bold text-red-500">{quantityError}</p>}
        </div>

        <PackChangeCheckbox
          checked={packChanged}
          onChange={(checked) => setValue(packChangedField, checked, { shouldDirty: true })}
          label={`เปลี่ยน ${title} pack ใหม่`}
        />

        <div
          className={`space-y-3 rounded-2xl border-2 p-4 transition-all ${
            packChanged ? "border-rose-100 bg-rose-50/40" : "border-slate-50 bg-slate-50/50"
          }`}
        >
          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-bold uppercase tracking-tight text-slate-400">Lot Number</label>
            <input
              type="text"
              readOnly={!packChanged}
              placeholder="กรอก Lot Number"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm font-bold outline-none transition-all ${
                packChanged
                  ? "border-rose-200 bg-white text-slate-700 shadow-inner focus:border-rose-400"
                  : "border-transparent bg-transparent text-slate-400"
              }`}
              {...register(lotField)}
            />
            {lotError && <p className="ml-1 text-[9px] font-bold text-red-500">{lotError}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="ml-1 text-[10px] font-bold uppercase tracking-tight text-slate-400">วันหมดอายุ</label>
            <input
              type="date"
              readOnly={!packChanged}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm font-bold outline-none transition-all ${
                packChanged
                  ? "border-rose-200 bg-white text-slate-700 shadow-inner focus:border-rose-400"
                  : "border-transparent bg-transparent text-slate-400"
              }`}
              {...register(expiryField)}
            />
            {expiryError && <p className="ml-1 text-[9px] font-bold text-red-500">{expiryError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecordForm({ ward, onSuccess, showToast, onValuesChange, initialData }: RecordFormProps) {
  const [user] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reagent: "",
      reagentExpiry: "",
      reagentLot: "",
      reagentPackChanged: false,
      wash: "",
      washExpiry: "",
      washLot: "",
      washPackChanged: false,
      qc: "",
      qcExpiry: "",
      qcLot: "",
      qcPackChanged: false,
      comment: "",
      deprotein: false,
      condition: false,
      waste: "ไม่ได้ทิ้ง Waste",
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        reagent: "",
        wash: "",
        qc: "",
        reagentPackChanged: false,
        washPackChanged: false,
        qcPackChanged: false,
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
      return;
    }

    reset({
      reagent: "",
      reagentExpiry: "",
      reagentLot: "",
      reagentPackChanged: false,
      wash: "",
      washExpiry: "",
      washLot: "",
      washPackChanged: false,
      qc: "",
      qcExpiry: "",
      qcLot: "",
      qcPackChanged: false,
      comment: "",
      deprotein: false,
      condition: false,
      waste: "ไม่ได้ทิ้ง Waste",
    });
  }, [initialData, reset]);

  const watchedValues = useWatch({ control });
  const lastUpdateRef = useRef("");
  const deproteinSelected = useWatch({ control, name: "deprotein" });
  const conditionSelected = useWatch({ control, name: "condition" });
  const wasteValue = useWatch({ control, name: "waste" });
  const reagentPackChanged = useWatch({ control, name: "reagentPackChanged" });
  const washPackChanged = useWatch({ control, name: "washPackChanged" });
  const qcPackChanged = useWatch({ control, name: "qcPackChanged" });
  const wasteSelected = wasteValue === "ทิ้ง Waste";

  useEffect(() => {
    if (!onValuesChange) return;

    const currentData: Record<string, unknown> = { ...watchedValues };
    if (watchedValues.reagent) currentData.reagent = parseFloat(watchedValues.reagent);
    else delete currentData.reagent;

    if (watchedValues.wash) currentData.wash = parseFloat(watchedValues.wash);
    else delete currentData.wash;

    if (watchedValues.qc) currentData.qc = parseFloat(watchedValues.qc);
    else delete currentData.qc;

    const dataString = JSON.stringify(currentData);
    if (dataString === lastUpdateRef.current) return;

    const timer = setTimeout(() => {
      lastUpdateRef.current = dataString;
      onValuesChange(currentData as Partial<BloodGasRecord>);
    }, 300);

    return () => clearTimeout(timer);
  }, [watchedValues, onValuesChange]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        ...data,
        ward,
        worker: user?.fullName || user?.username,
      };

      if (data.reagent) payload.reagent = parseFloat(data.reagent);
      if (data.wash) payload.wash = parseFloat(data.wash);
      if (data.qc) payload.qc = parseFloat(data.qc);

      const res = await api.post("saveRecord", { data: payload });

      if (res.success) {
        showToast("บันทึกสำเร็จ");
        setValue("reagent", "");
        setValue("wash", "");
        setValue("qc", "");
        setValue("reagentPackChanged", false);
        setValue("washPackChanged", false);
        setValue("qcPackChanged", false);
        setValue("comment", "");
        setValue("deprotein", false);
        setValue("condition", false);
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ReagentSection
          title="Reagent"
          quantityField="reagent"
          lotField="reagentLot"
          expiryField="reagentExpiry"
          packChangedField="reagentPackChanged"
          quantityError={errors.reagent?.message}
          lotError={errors.reagentLot?.message}
          expiryError={errors.reagentExpiry?.message}
          colorClasses={{
            icon: "bg-sky-500 text-sky-500",
            focusBorder: "focus:border-sky-400",
            focusRing: "focus:ring-4 focus:ring-sky-50",
          }}
          register={register}
          packChanged={reagentPackChanged}
          setValue={setValue}
        />

        <ReagentSection
          title="Wash"
          quantityField="wash"
          lotField="washLot"
          expiryField="washExpiry"
          packChangedField="washPackChanged"
          quantityError={errors.wash?.message}
          lotError={errors.washLot?.message}
          expiryError={errors.washExpiry?.message}
          colorClasses={{
            icon: "bg-violet-500 text-violet-500",
            focusBorder: "focus:border-violet-400",
            focusRing: "focus:ring-4 focus:ring-violet-50",
          }}
          register={register}
          packChanged={washPackChanged}
          setValue={setValue}
        />

        <ReagentSection
          title="QC"
          quantityField="qc"
          lotField="qcLot"
          expiryField="qcExpiry"
          packChangedField="qcPackChanged"
          quantityError={errors.qc?.message}
          lotError={errors.qcLot?.message}
          expiryError={errors.qcExpiry?.message}
          colorClasses={{
            icon: "bg-emerald-500 text-emerald-500",
            focusBorder: "focus:border-emerald-400",
            focusRing: "focus:ring-4 focus:ring-emerald-50",
          }}
          register={register}
          packChanged={qcPackChanged}
          setValue={setValue}
        />
      </div>

      <div className="space-y-4">
        <SectionHeader icon={<CheckCircle2 size={16} />} title="Preventive Maintenance & Waste" color="bg-slate-500 text-slate-500" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setValue("deprotein", !deproteinSelected, { shouldDirty: true })}
              className={`group flex cursor-pointer items-center gap-3 rounded-[1.5rem] border-2 p-6 transition-all active:scale-[0.97] touch-manipulation ${
                deproteinSelected
                  ? "border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100"
                  : "border-slate-100 bg-white hover:border-slate-200"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  deproteinSelected ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-300"
                }`}
              >
                <CheckCircle2 size={18} />
              </div>
              <div className="text-xs font-extrabold uppercase tracking-tight text-slate-700">Deprotein</div>
            </button>

            <button
              type="button"
              onClick={() => setValue("condition", !conditionSelected, { shouldDirty: true })}
              className={`group flex cursor-pointer items-center gap-3 rounded-[1.5rem] border-2 p-6 transition-all active:scale-[0.97] touch-manipulation ${
                conditionSelected
                  ? "border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100"
                  : "border-slate-100 bg-white hover:border-slate-200"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  conditionSelected ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-300"
                }`}
              >
                <CheckCircle2 size={18} />
              </div>
              <div className="text-xs font-extrabold uppercase tracking-tight text-slate-700">Condition</div>
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              setValue("waste", wasteSelected ? "ไม่ได้ทิ้ง Waste" : "ทิ้ง Waste", { shouldDirty: true })
            }
            className={`group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-[1.5rem] border-2 p-6 transition-all active:scale-[0.97] touch-manipulation ${
              wasteSelected
                ? "border-rose-400 bg-rose-50 shadow-md shadow-rose-100"
                : "border-slate-100 bg-white hover:border-slate-200"
            }`}
          >
            <div className="relative z-10 flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl transition-all ${
                  wasteSelected ? "rotate-12 bg-rose-500 text-white" : "bg-slate-100 text-slate-400"
                }`}
              >
                <Trash2 size={24} />
              </div>
              <div className="text-left">
                <div className={`text-sm font-extrabold transition-colors ${wasteSelected ? "text-rose-700" : "text-slate-700"}`}>
                  {wasteSelected ? "นำของเสียไปทิ้งแล้ว" : "ตรวจสอบถังของเสีย (Waste)"}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {wasteSelected ? "Discarded Successfully" : "Click to mark as discarded"}
                </div>
              </div>
            </div>

            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                wasteSelected ? "scale-110 border-rose-500 bg-rose-500" : "border-slate-200 bg-transparent"
              }`}
            >
              {wasteSelected && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader icon={<MessageCircle size={16} />} title="Handover Note" color="bg-amber-500 text-amber-500" />
        <textarea
          placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)..."
          className="min-h-[140px] w-full rounded-[1.5rem] border-2 border-slate-100 bg-white px-6 py-6 text-base leading-relaxed outline-none transition-all shadow-sm focus:border-amber-400 focus:shadow-xl focus:shadow-amber-100"
          {...register("comment")}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-[2.5rem] bg-[#0a4d68] py-6 text-xl font-extrabold text-white shadow-xl shadow-sky-900/20 transition-all active:scale-[0.99] active:bg-[#088395] touch-manipulation disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="absolute inset-0 translate-y-full bg-white/10 transition-transform duration-300 group-hover:translate-y-0" />
        {isSubmitting ? (
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        ) : (
          <Send size={24} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
        )}
        <span className="relative z-10 tracking-tight">{isSubmitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</span>
      </button>
    </form>
  );
}
