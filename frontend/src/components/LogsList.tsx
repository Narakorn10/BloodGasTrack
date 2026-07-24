"use client";

import { Fragment, useDeferredValue, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  Download,
  Eraser,
  History,
  Loader2,
  MessageSquareText,
  Search,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/api";
import { fmtD, fmtDT } from "@/lib/utils";
import {
  AuditChange,
  AuditLogEntry,
  BloodGasRecord,
  LogEventType,
  LogQuery,
  LogsResponse,
} from "@/lib/types";

type DatePreset = "7" | "30" | "90" | "all";

const EVENT_LABELS: Record<LogEventType, string> = {
  status_update: "อัปเดตสถานะ",
  pack_change: "เปลี่ยน Pack",
  maintenance: "บำรุงรักษา",
  service_visit: "ช่างเข้าบริการ",
  waste: "ทิ้ง Waste",
  comment: "มีข้อความส่งต่อ",
};

const EVENT_STYLES: Record<LogEventType, string> = {
  status_update: "border-sky-200 bg-sky-50 text-sky-700",
  pack_change: "border-rose-200 bg-rose-50 text-rose-700",
  maintenance: "border-emerald-200 bg-emerald-50 text-emerald-700",
  service_visit: "border-indigo-200 bg-indigo-50 text-indigo-700",
  waste: "border-orange-200 bg-orange-50 text-orange-700",
  comment: "border-amber-200 bg-amber-50 text-amber-800",
};

const PRODUCTS = [
  {
    label: "Reagent",
    valueField: "reagent",
    lotField: "reagentLot",
    expiryField: "reagentExpiry",
    changedAtField: "reagentChangedAt",
    dot: "bg-sky-500",
    border: "border-sky-100",
    surface: "bg-sky-50/40",
    value: "text-sky-700",
  },
  {
    label: "Wash",
    valueField: "wash",
    lotField: "washLot",
    expiryField: "washExpiry",
    changedAtField: "washChangedAt",
    dot: "bg-violet-500",
    border: "border-violet-100",
    surface: "bg-violet-50/40",
    value: "text-violet-700",
  },
  {
    label: "QC",
    valueField: "qc",
    lotField: "qcLot",
    expiryField: "qcExpiry",
    changedAtField: "qcChangedAt",
    dot: "bg-emerald-500",
    border: "border-emerald-100",
    surface: "bg-emerald-50/40",
    value: "text-emerald-700",
  },
] as const;

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateRange(preset: DatePreset) {
  if (preset === "all") return {};
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - Number(preset) + 1);
  return { dateFrom: localDateString(start), dateTo: localDateString(end) };
}

function normalizeLog(raw: AuditLogEntry, index: number): AuditLogEntry {
  const eventTypes = Array.isArray(raw.eventTypes) && raw.eventTypes.length > 0
    ? raw.eventTypes
    : raw.comment?.trim()
      ? ["comment" as const]
      : ["status_update" as const];
  return {
    ...raw,
    id: raw.id || `legacy-${raw.timestamp || "unknown"}-${index}`,
    actor: raw.actor || { username: "", name: raw.worker || "ไม่ระบุผู้บันทึก" },
    eventTypes,
    changes: Array.isArray(raw.changes) ? raw.changes : [],
    isLegacy: raw.isLegacy ?? true,
  };
}

function findChange(log: AuditLogEntry, field: string) {
  return log.changes.find((change) => change.field === field);
}

function displayValue(value: unknown, fallback = "–") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "ทำ" : "ไม่ได้ทำ";
  return String(value);
}

function displayPercent(value: unknown) {
  const text = displayValue(value);
  return text === "–" ? text : `${text}%`;
}

function packChangeCount(log: AuditLogEntry) {
  return PRODUCTS.filter((product) => Boolean(findChange(log, product.changedAtField))).length;
}

function createQuery(
  ward: string,
  preset: DatePreset,
  eventType: LogEventType | "all",
  onlyWithComment: boolean,
  query: string,
  cursor?: string,
  limit = 20,
): LogQuery & Record<string, unknown> {
  return {
    ward,
    ...getDateRange(preset),
    eventTypes: eventType === "all" ? undefined : [eventType],
    onlyWithComment,
    query: query.trim() || undefined,
    cursor,
    limit,
  };
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(logs: AuditLogEntry[]) {
  const headers = [
    "Log ID",
    "วันเวลา",
    "Ward",
    "ผู้บันทึก",
    "Username",
    "ประเภทเหตุการณ์",
    "Reagent (%)",
    "Reagent Lot",
    "Reagent Expiry",
    "วันที่เปลี่ยน Reagent",
    "Wash (%)",
    "Wash Lot",
    "Wash Expiry",
    "วันที่เปลี่ยน Wash",
    "QC (%)",
    "QC Lot",
    "QC Expiry",
    "วันที่เปลี่ยน QC",
    "Deprotein",
    "Condition",
    "Waste",
    "ช่างเข้าบริการ",
    "บริษัท",
    "ช่างหรือผู้เชี่ยวชาญ",
    "งานที่ดำเนินการ",
    "ทำ PM",
    "ช่างเปลี่ยน Reagent",
    "ช่างเปลี่ยน Wash",
    "ช่างเปลี่ยน QC",
    "ข้อความส่งต่องาน",
    "ค่าที่เปลี่ยน",
    "ข้อมูลเดิม",
  ];
  const rows = logs.map((log) => [
    log.id,
    log.timestamp,
    log.ward,
    log.actor.name || log.worker,
    log.actor.username,
    log.eventTypes.map((type) => EVENT_LABELS[type] || type).join(", "),
    log.reagent,
    log.reagentLot,
    log.reagentExpiry,
    log.reagentChangedAt,
    log.wash,
    log.washLot,
    log.washExpiry,
    log.washChangedAt,
    log.qc,
    log.qcLot,
    log.qcExpiry,
    log.qcChangedAt,
    log.deprotein ? "ทำ" : "ไม่ได้ทำ",
    log.condition ? "ทำ" : "ไม่ได้ทำ",
    log.waste,
    log.serviceVisit ? "ใช่" : "ไม่ใช่",
    log.serviceCompany,
    log.serviceTechnician,
    log.serviceWork,
    log.servicePmPerformed ? "ทำ PM แล้ว" : "ไม่ได้ทำ PM",
    log.serviceReagentChanged ? "เปลี่ยน" : "ไม่ได้เปลี่ยน",
    log.serviceWashChanged ? "เปลี่ยน" : "ไม่ได้เปลี่ยน",
    log.serviceQcChanged ? "เปลี่ยน" : "ไม่ได้เปลี่ยน",
    log.comment,
    log.changes
      .map((change) => `${change.field}: ${displayValue(change.before)} -> ${displayValue(change.after)}`)
      .join(" | "),
    log.isLegacy ? "ใช่" : "ไม่ใช่",
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function EventBadges({ log }: { log: AuditLogEntry }) {
  const count = packChangeCount(log);
  return (
    <div className="flex flex-wrap gap-1.5">
      {log.eventTypes.map((type) => (
        <span
          key={type}
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${EVENT_STYLES[type] || EVENT_STYLES.status_update}`}
        >
          {type === "pack_change" && count > 0
            ? `เปลี่ยน Pack ${count} รายการ`
            : EVENT_LABELS[type] || type}
        </span>
      ))}
      {log.isLegacy && (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
          ข้อมูลเดิม
        </span>
      )}
    </div>
  );
}

function MetricValue({ value, tone }: { value: number; tone: string }) {
  return (
    <span className={`font-mono text-sm font-extrabold ${tone}`}>
      {typeof value === "number" ? `${value}%` : "–"}
    </span>
  );
}

function TransitionValue({
  change,
  current,
  formatter = displayValue,
}: {
  change?: AuditChange;
  current: unknown;
  formatter?: (value: unknown) => string;
}) {
  if (!change) return <span className="font-semibold text-slate-700">{formatter(current)}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 font-semibold">
      <span className="text-slate-400 line-through decoration-slate-300">{formatter(change.before)}</span>
      <span className="text-slate-300">→</span>
      <span className="text-slate-800">{formatter(change.after)}</span>
    </span>
  );
}

function ExpandedDetails({ log }: { log: AuditLogEntry }) {
  return (
    <div className="space-y-4">
      {log.eventTypes.includes("service_visit") && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-extrabold text-indigo-800">
            <Wrench size={15} />
            รายละเอียดการเข้าบริการช่าง
          </div>
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs font-bold text-indigo-500">บริษัท</dt>
              <dd className="mt-1 font-semibold text-slate-800">{log.serviceCompany || "ไม่ระบุ"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-indigo-500">ช่างหรือผู้เชี่ยวชาญ</dt>
              <dd className="mt-1 font-semibold text-slate-800">{log.serviceTechnician || "ไม่ระบุ"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-xs font-bold text-indigo-500">งานที่ดำเนินการ</dt>
              <dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-800">{log.serviceWork || "ไม่ระบุ"}</dd>
            </div>
          </dl>
          <div className={`mt-4 inline-flex rounded-xl border px-3 py-2 text-xs font-bold ${log.servicePmPerformed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}>
            PM: {log.servicePmPerformed ? "ช่างทำ PM แล้ว" : "ช่างไม่ได้ทำ PM"}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRODUCTS.map((product) => {
              const serviceField = product.label === "Reagent"
                ? "serviceReagentChanged"
                : product.label === "Wash"
                  ? "serviceWashChanged"
                  : "serviceQcChanged";
              const changed = Boolean(log[serviceField as keyof BloodGasRecord]) || Boolean(findChange(log, product.changedAtField));
              return (
                <span
                  key={product.label}
                  className={`rounded-xl border px-3 py-2 text-xs font-bold ${changed ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-500"}`}
                >
                  {product.label}: {changed ? "เปลี่ยน Pack" : "ไม่ได้เปลี่ยน"}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        {PRODUCTS.map((product) => {
          const value = log[product.valueField as keyof BloodGasRecord];
          const lot = log[product.lotField as keyof BloodGasRecord];
          const expiry = log[product.expiryField as keyof BloodGasRecord];
          const changedAt = log[product.changedAtField as keyof BloodGasRecord];
          const changedThisEvent = Boolean(findChange(log, product.changedAtField));
          return (
            <div
              key={product.label}
              className={`rounded-2xl border p-4 ${product.border} ${product.surface}`}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${product.dot}`} />
                  <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-700">
                    {product.label}
                  </span>
                </div>
                {changedThisEvent && (
                  <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-rose-600 shadow-sm">
                    Pack ใหม่
                  </span>
                )}
              </div>
              <dl className="space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">ปริมาณ</dt>
                  <dd className={product.value}>
                    <TransitionValue
                      change={findChange(log, product.valueField)}
                      current={value}
                      formatter={displayPercent}
                    />
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">Lot</dt>
                  <dd className="text-right">
                    <TransitionValue change={findChange(log, product.lotField)} current={lot} />
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-slate-400">EXP</dt>
                  <dd className="text-right">
                    <TransitionValue
                      change={findChange(log, product.expiryField)}
                      current={expiry}
                      formatter={(item) => item ? fmtD(String(item)) : "–"}
                    />
                  </dd>
                </div>
                <div className="border-t border-white/80 pt-2.5">
                  <dt className="text-slate-400">เปลี่ยนล่าสุด</dt>
                  <dd className="mt-0.5 font-bold text-slate-700">
                    {changedAt ? fmtDT(String(changedAt)) : "ยังไม่มีข้อมูล"}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${log.deprotein ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
          Deprotein: {log.deprotein ? "ทำ" : "ไม่ได้ทำ"}
        </span>
        <span className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${log.condition ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
          Condition: {log.condition ? "ทำ" : "ไม่ได้ทำ"}
        </span>
        <span className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${log.waste === "ทิ้ง Waste" ? "border-orange-200 bg-orange-50 text-orange-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
          Waste: {log.waste || "ไม่ได้ทิ้ง Waste"}
        </span>
      </div>

      {log.comment?.trim() && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-amber-800">
            <MessageSquareText size={15} />
            ข้อความส่งต่องาน
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-amber-950">{log.comment}</p>
          <div className="mt-3 border-t border-amber-200/70 pt-2 text-[10px] font-semibold text-amber-700">
            บันทึกโดย {log.actor.name || log.worker || "ไม่ระบุ"} · {fmtDT(log.timestamp)}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
        <span>Ward: {log.ward}</span>
        <span className="font-mono">Event ID: {log.id}</span>
      </div>
    </div>
  );
}

function HandoverPreview({ comment }: { comment: string }) {
  if (!comment?.trim()) return null;
  return (
    <div className="mt-2 flex min-w-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <MessageSquareText size={14} className="shrink-0 text-amber-600" />
      <span className="shrink-0 font-extrabold">ส่งต่องาน:</span>
      <span className="truncate">{comment.replace(/\s+/g, " ").trim()}</span>
    </div>
  );
}

export function LogsList({ ward, refreshKey = 0 }: { ward: string; refreshKey?: number }) {
  const [datePreset, setDatePreset] = useState<DatePreset>("30");
  const [eventType, setEventType] = useState<LogEventType | "all">("all");
  const [onlyWithComment, setOnlyWithComment] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    if (!ward) return;

    const version = ++requestVersion.current;

    const load = async () => {
      setLoading(true);
      setError("");
      setExpandedId(null);
      const response = await api.post(
        "getLogs",
        createQuery(ward, datePreset, eventType, onlyWithComment, deferredQuery),
      ) as LogsResponse;
      if (version !== requestVersion.current) return;
      if (!response.success) {
        setLogs([]);
        setError(response.message || "ไม่สามารถโหลดประวัติได้");
      } else {
        setLogs((response.logs || []).map(normalizeLog));
        setNextCursor(response.nextCursor || null);
        setHasMore(Boolean(response.hasMore));
      }
      setLoading(false);
    };

    load().catch(() => {
      if (version !== requestVersion.current) return;
      setLogs([]);
      setError("ไม่สามารถโหลดประวัติได้");
      setLoading(false);
    });
  }, [ward, datePreset, eventType, onlyWithComment, deferredQuery, refreshKey]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await api.post(
        "getLogs",
        createQuery(ward, datePreset, eventType, onlyWithComment, deferredQuery, nextCursor),
      ) as LogsResponse;
      if (!response.success) throw new Error(response.message);
      setLogs((current) => [
        ...current,
        ...(response.logs || []).map((log, index) => normalizeLog(log, current.length + index)),
      ]);
      setNextCursor(response.nextCursor || null);
      setHasMore(Boolean(response.hasMore));
    } catch {
      setError("โหลดประวัติเพิ่มไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    setError("");
    try {
      const allLogs: AuditLogEntry[] = [];
      let cursor: string | undefined;
      let more = true;
      while (more && allLogs.length <= 5000) {
        const response = await api.post(
          "getLogs",
          createQuery(ward, datePreset, eventType, onlyWithComment, deferredQuery, cursor, 50),
        ) as LogsResponse;
        if (!response.success) throw new Error(response.message);
        allLogs.push(...(response.logs || []).map((log, index) => normalizeLog(log, allLogs.length + index)));
        cursor = response.nextCursor || undefined;
        more = Boolean(response.hasMore && cursor);
      }
      if (allLogs.length > 5000) {
        throw new Error("ประวัติมากกว่า 5,000 รายการ กรุณาลดช่วงวันที่ก่อนส่งออก");
      }
      if (allLogs.length === 0) throw new Error("ไม่มีข้อมูลตามตัวกรองสำหรับส่งออก");

      const blob = new Blob([buildCsv(allLogs)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeWard = ward.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-");
      link.href = url;
      link.download = `blood-gas-log-${safeWard}-${localDateString(new Date())}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "ส่งออก CSV ไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setDatePreset("30");
    setEventType("all");
    setOnlyWithComment(false);
    setQuery("");
  };

  const hasActiveFilters = datePreset !== "30" || eventType !== "all" || onlyWithComment || query.trim();

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#f0f9ff_55%,#ffffff_100%)] p-5 sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
              <History size={18} className="text-sky-600" />
              ประวัติการทำงานของ {ward}
            </div>
            <p className="mt-1 text-xs text-slate-500">ตรวจสอบการเปลี่ยน Pack งานบำรุงรักษา การเข้าบริการช่าง และข้อความส่งต่องาน</p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0a4d68] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#08617d] focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {exporting ? "กำลังเตรียม CSV..." : "ส่งออก CSV"}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[150px_190px_minmax(220px,1fr)]">
          <label className="space-y-1.5">
            <span className="ml-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <CalendarDays size={12} /> ช่วงเวลา
            </span>
            <select
              value={datePreset}
              onChange={(event) => setDatePreset(event.target.value as DatePreset)}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="7">7 วันล่าสุด</option>
              <option value="30">30 วันล่าสุด</option>
              <option value="90">90 วันล่าสุด</option>
              <option value="all">ทั้งหมด</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">ประเภทเหตุการณ์</span>
            <select
              value={eventType}
              onChange={(event) => setEventType(event.target.value as LogEventType | "all")}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="all">ทุกประเภท</option>
              <option value="pack_change">เปลี่ยน Pack</option>
              <option value="maintenance">บำรุงรักษา</option>
              <option value="service_visit">ช่างเข้าบริการ</option>
              <option value="waste">ทิ้ง Waste</option>
              <option value="comment">ข้อความส่งต่องาน</option>
              <option value="status_update">อัปเดตสถานะ</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">ค้นหา</span>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ผู้บันทึก, ช่าง, บริษัท, Lot หรือข้อความ"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-900">
            <input
              type="checkbox"
              checked={onlyWithComment}
              onChange={(event) => setOnlyWithComment(event.target.checked)}
              className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-300"
            />
            เฉพาะรายการที่มีข้อความส่งต่อ
          </label>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <Eraser size={14} /> ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 size={28} className="animate-spin text-sky-500" />
          <span className="text-xs font-bold">กำลังโหลดประวัติ...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">
            <History size={28} />
          </div>
          <div>
            <div className="font-bold text-slate-700">ไม่พบประวัติตามเงื่อนไข</div>
            <p className="mt-1 text-xs text-slate-400">ลองขยายช่วงเวลาหรือล้างตัวกรองเพื่อดูรายการทั้งหมด</p>
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="text-xs font-bold text-sky-700 underline underline-offset-4">
              ล้างตัวกรอง
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">เวลา / ผู้บันทึก</th>
                  <th className="min-w-64 px-4 py-3">เหตุการณ์ / ส่งต่องาน</th>
                  <th className="px-3 py-3 text-center">Reagent</th>
                  <th className="px-3 py-3 text-center">Wash</th>
                  <th className="px-3 py-3 text-center">QC</th>
                  <th className="w-16 px-4 py-3"><span className="sr-only">รายละเอียด</span></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const expanded = expandedId === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr className={`border-t border-slate-100 align-top transition ${expanded ? "bg-sky-50/40" : "hover:bg-slate-50/60"}`}>
                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="font-bold text-slate-800">{fmtDT(log.timestamp)}</div>
                          <div className="mt-1 text-xs text-slate-500">{log.actor.name || log.worker || "ไม่ระบุผู้บันทึก"}</div>
                        </td>
                        <td className="px-4 py-4">
                          <EventBadges log={log} />
                          <HandoverPreview comment={log.comment} />
                        </td>
                        <td className="px-3 py-4 text-center"><MetricValue value={log.reagent} tone="text-sky-700" /></td>
                        <td className="px-3 py-4 text-center"><MetricValue value={log.wash} tone="text-violet-700" /></td>
                        <td className="px-3 py-4 text-center"><MetricValue value={log.qc} tone="text-emerald-700" /></td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-label={expanded ? "ปิดรายละเอียด" : "เปิดรายละเอียด"}
                            onClick={() => setExpandedId(expanded ? null : log.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          >
                            <ChevronDown size={17} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-t border-sky-100 bg-sky-50/30">
                          <td colSpan={6} className="px-5 py-5">
                            <ExpandedDetails log={log} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {logs.map((log) => {
              const expanded = expandedId === log.id;
              return (
                <article key={log.id} className={expanded ? "bg-sky-50/30" : "bg-white"}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedId(expanded ? null : log.id)}
                    className="w-full p-4 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-800">{fmtDT(log.timestamp)}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">{log.actor.name || log.worker || "ไม่ระบุผู้บันทึก"}</div>
                      </div>
                      <ChevronDown size={18} className={`mt-1 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </div>
                    <div className="mt-3"><EventBadges log={log} /></div>
                    <HandoverPreview comment={log.comment} />
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-sky-50 p-2 text-center"><div className="text-[9px] font-bold text-sky-500">REAGENT</div><MetricValue value={log.reagent} tone="text-sky-700" /></div>
                      <div className="rounded-xl bg-violet-50 p-2 text-center"><div className="text-[9px] font-bold text-violet-500">WASH</div><MetricValue value={log.wash} tone="text-violet-700" /></div>
                      <div className="rounded-xl bg-emerald-50 p-2 text-center"><div className="text-[9px] font-bold text-emerald-500">QC</div><MetricValue value={log.qc} tone="text-emerald-700" /></div>
                    </div>
                  </button>
                  {expanded && <div className="border-t border-sky-100 px-4 py-5"><ExpandedDetails log={log} /></div>}
                </article>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-4">
            <span className="text-[10px] font-semibold text-slate-400">แสดงแล้ว {logs.length} รายการ</span>
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:opacity-50"
              >
                {loadingMore && <Loader2 size={14} className="animate-spin" />}
                {loadingMore ? "กำลังโหลด..." : "โหลดเพิ่มเติม"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
