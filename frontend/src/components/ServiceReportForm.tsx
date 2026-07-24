"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CheckCircle2, Droplets, Send, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { User } from "@/lib/types";

const schema = z.object({
  serviceWork: z.string().trim().min(1, "โปรดระบุงานที่ดำเนินการ"),
  servicePmPerformed: z.boolean(),
  serviceReagentChanged: z.boolean(),
  serviceWashChanged: z.boolean(),
  serviceQcChanged: z.boolean(),
  comment: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function PackAction({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
        checked ? "border-rose-300 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      <span className="font-bold">{label}</span>
      <span className="text-xs font-extrabold">{checked ? "เปลี่ยนแล้ว" : "ไม่ได้เปลี่ยน"}</span>
    </button>
  );
}

export function ServiceReportForm({
  ward,
  user,
  onSuccess,
  showToast,
}: {
  ward: string;
  user: User;
  onSuccess: () => void;
  showToast: (message: string, isError?: boolean) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      serviceWork: "",
      servicePmPerformed: false,
      serviceReagentChanged: false,
      serviceWashChanged: false,
      serviceQcChanged: false,
      comment: "",
    },
  });
  const servicePmPerformed = useWatch({ control, name: "servicePmPerformed" });
  const serviceReagentChanged = useWatch({ control, name: "serviceReagentChanged" });
  const serviceWashChanged = useWatch({ control, name: "serviceWashChanged" });
  const serviceQcChanged = useWatch({ control, name: "serviceQcChanged" });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const response = await api.post("saveServiceReport", { data: { ...values, ward } });
      if (!response.success) throw new Error(response.message || "บันทึกรายงานไม่สำเร็จ");
      reset();
      onSuccess();
      showToast("บันทึกรายงานงานช่างสำเร็จ");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "บันทึกรายงานไม่สำเร็จ", true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-indigo-600 p-2.5 text-white"><Wrench size={20} /></span>
          <div>
            <h2 className="font-extrabold text-indigo-950">รายงานการเข้าบริการ</h2>
            <p className="mt-1 text-sm text-indigo-800">{user.company || "บริษัทไม่ระบุ"} · {user.fullName}</p>
            <p className="mt-1 text-xs font-semibold text-indigo-700">รายงานนี้จะไม่แก้ไขปริมาณน้ำยา, Lot หรือ EXP ของ Ward</p>
          </div>
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-bold text-slate-700">งานที่ดำเนินการ</span>
        <textarea
          {...register("serviceWork")}
          placeholder="ระบุอาการที่ตรวจพบ งานที่ซ่อม/ปรับตั้ง และคำแนะนำแก่ Ward"
          className="min-h-36 w-full rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-sm leading-6 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        {errors.serviceWork && <p className="text-xs font-bold text-rose-600">{errors.serviceWork.message}</p>}
      </label>

      <button
        type="button"
        onClick={() => setValue("servicePmPerformed", !servicePmPerformed, { shouldDirty: true })}
        className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${servicePmPerformed ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
      >
        <span className="flex items-center gap-3"><CheckCircle2 size={19} /> ทำ Preventive Maintenance (PM)</span>
        <span className="text-xs font-extrabold">{servicePmPerformed ? "ทำ PM แล้ว" : "ไม่ได้ทำ PM"}</span>
      </button>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700"><Droplets size={17} /> ผลการเปลี่ยน Pack โดยช่าง</div>
        <div className="grid gap-3 md:grid-cols-3">
          <PackAction label="Reagent" checked={serviceReagentChanged} onChange={() => setValue("serviceReagentChanged", !serviceReagentChanged, { shouldDirty: true })} />
          <PackAction label="Wash" checked={serviceWashChanged} onChange={() => setValue("serviceWashChanged", !serviceWashChanged, { shouldDirty: true })} />
          <PackAction label="QC" checked={serviceQcChanged} onChange={() => setValue("serviceQcChanged", !serviceQcChanged, { shouldDirty: true })} />
        </div>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-bold text-slate-700">ข้อความส่งต่อหรือข้อเสนอแนะ</span>
        <textarea
          {...register("comment")}
          placeholder="ระบุสิ่งที่ Ward ต้องติดตามต่อ (ถ้ามี)"
          className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm leading-6 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-indigo-700 py-4 font-extrabold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-800 disabled:opacity-50"
      >
        <Send size={18} /> {submitting ? "กำลังบันทึก..." : "บันทึกรายงานงานช่าง"}
      </button>
    </form>
  );
}
