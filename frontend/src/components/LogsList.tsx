"use client";

import { fmtD, fmtDT } from "@/lib/utils";
import { BloodGasRecord } from "@/lib/types";

interface DailyLogRow {
  dateKey: string;
  latestTimestamp: string;
  latestWorker: string;
  latestWard: string;
  reagent: number;
  wash: number;
  qc: number;
  deprotein: boolean;
  condition: boolean;
  waste: boolean;
  hasComment: boolean;
  packChanged: boolean;
  entries: number;
}

function formatPercent(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value}%`;
}

function getDateKey(timestamp: string) {
  if (!timestamp) return "";
  return timestamp.slice(0, 10);
}

function groupLogsByDay(logs: BloodGasRecord[]): DailyLogRow[] {
  const grouped = new Map<string, DailyLogRow>();

  for (const log of logs) {
    if (log.ward === "(Login)") continue;

    const dateKey = getDateKey(log.timestamp);
    const existing = grouped.get(dateKey);
    const isNewer = !existing || new Date(log.timestamp).getTime() > new Date(existing.latestTimestamp).getTime();

    if (!existing) {
      grouped.set(dateKey, {
        dateKey,
        latestTimestamp: log.timestamp,
        latestWorker: log.worker || "-",
        latestWard: log.ward || "-",
        reagent: log.reagent,
        wash: log.wash,
        qc: log.qc,
        deprotein: !!log.deprotein,
        condition: !!log.condition,
        waste: log.waste === "ทิ้ง Waste",
        hasComment: !!log.comment?.trim(),
        packChanged: !!(log.reagentPackChanged || log.washPackChanged || log.qcPackChanged),
        entries: 1,
      });
      continue;
    }

    existing.deprotein = existing.deprotein || !!log.deprotein;
    existing.condition = existing.condition || !!log.condition;
    existing.waste = existing.waste || log.waste === "ทิ้ง Waste";
    existing.hasComment = existing.hasComment || !!log.comment?.trim();
    existing.packChanged =
      existing.packChanged || !!(log.reagentPackChanged || log.washPackChanged || log.qcPackChanged);
    existing.entries += 1;

    if (isNewer) {
      existing.latestTimestamp = log.timestamp;
      existing.latestWorker = log.worker || "-";
      existing.latestWard = log.ward || "-";
      existing.reagent = log.reagent;
      existing.wash = log.wash;
      existing.qc = log.qc;
    }
  }

  return Array.from(grouped.values()).sort(
    (a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime()
  );
}

function StatusCheckbox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <label className="flex items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        readOnly
        aria-label={label}
        className="h-4 w-4 rounded border-slate-300 text-[#0a4d68] focus:ring-0"
      />
    </label>
  );
}

export function LogsList({ logs }: { logs: BloodGasRecord[] }) {
  const dailyLogs = groupLogsByDay(logs);

  if (dailyLogs.length === 0) {
    return <div className="py-10 text-center text-slate-400">ยังไม่มีประวัติการบันทึก</div>;
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-slate-700">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-bold">วันที่</th>
              <th className="px-4 py-3 text-left font-bold">ข้อมูลล่าสุด</th>
              <th className="px-3 py-3 text-center font-bold">Reagent</th>
              <th className="px-3 py-3 text-center font-bold">Wash</th>
              <th className="px-3 py-3 text-center font-bold">QC</th>
              <th className="px-3 py-3 text-center font-bold">Deprotein</th>
              <th className="px-3 py-3 text-center font-bold">Condition</th>
              <th className="px-3 py-3 text-center font-bold">Waste</th>
              <th className="px-3 py-3 text-center font-bold">Comment</th>
              <th className="px-3 py-3 text-center font-bold">Pack ใหม่</th>
            </tr>
          </thead>
          <tbody>
            {dailyLogs.map((log) => (
              <tr key={log.dateKey} className="border-t border-slate-100 align-middle hover:bg-sky-50/30">
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-800">{fmtD(log.dateKey)}</div>
                  <div className="text-xs text-slate-400">{log.entries} รายการ</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-700">{fmtDT(log.latestTimestamp)}</div>
                  <div className="text-xs text-slate-500">
                    {log.latestWorker} · {log.latestWard}
                  </div>
                </td>
                <td className="px-3 py-3 text-center font-mono font-bold">{formatPercent(log.reagent)}</td>
                <td className="px-3 py-3 text-center font-mono font-bold">{formatPercent(log.wash)}</td>
                <td className="px-3 py-3 text-center font-mono font-bold">{formatPercent(log.qc)}</td>
                <td className="px-3 py-3">
                  <StatusCheckbox checked={log.deprotein} label="Deprotein" />
                </td>
                <td className="px-3 py-3">
                  <StatusCheckbox checked={log.condition} label="Condition" />
                </td>
                <td className="px-3 py-3">
                  <StatusCheckbox checked={log.waste} label="Waste" />
                </td>
                <td className="px-3 py-3">
                  <StatusCheckbox checked={log.hasComment} label="Comment" />
                </td>
                <td className="px-3 py-3">
                  <StatusCheckbox checked={log.packChanged} label="Pack changed" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
