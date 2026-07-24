import axios from 'axios';
import { MOCK_DATA } from './mockData';
import { AuditChange, AuditLogEntry, BloodGasRecord, LogEventType } from './types';

const FORCE_MOCK = process.env.NEXT_PUBLIC_FORCE_MOCK === "true";
const GAS_URL = !FORCE_MOCK && process.env.NEXT_PUBLIC_GAS_URL 
  ? `https://script.google.com/macros/s/${process.env.NEXT_PUBLIC_GAS_URL}/exec`
  : null;

export const isMockMode = !GAS_URL;

interface ApiPayload {
  ward?: string;
  username?: string;
  password?: string;
  sessionToken?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export const api = {
  async post(action: string, payload: ApiPayload = {}) {
    // 1. Get credentials from localStorage if available
    let username = payload.username;
    let password = payload.password;
    let sessionToken = payload.sessionToken;

    if (!sessionToken || !username || !password) {
      const savedUser = typeof window !== 'undefined' ? localStorage.getItem("user") : null;
      const savedCred = typeof window !== 'undefined' ? localStorage.getItem("cred") : null;
      const savedToken = typeof window !== 'undefined' ? localStorage.getItem("sessionToken") : null;

      if (savedUser && savedCred) {
        const parsedUser = JSON.parse(savedUser);
        username = parsedUser.username;
        password = savedCred; // Password stored separately for security/clarity
        sessionToken = sessionToken || parsedUser.sessionToken || savedToken || undefined;
      }
    }

    // 2. If GAS_URL is missing, use Mock Mode
    if (!GAS_URL) {
      console.warn(`[Mock API] Action: ${action}`, payload);
      
      if (action === 'saveRecord' && payload.data) {
        const submitted = payload.data as Partial<BloodGasRecord> & {
          ward: string;
          reagentPackChanged?: boolean;
          washPackChanged?: boolean;
          qcPackChanged?: boolean;
        };
        const previous = MOCK_DATA.records[submitted.ward];
        const timestamp = new Date().toISOString();
        const newRec: BloodGasRecord = {
          ...previous,
          ...submitted,
          timestamp,
          ward: submitted.ward,
          worker: submitted.worker || previous?.worker || "ผู้ใช้งาน (Mock)",
          reagentChangedAt: submitted.reagentPackChanged ? timestamp : previous?.reagentChangedAt,
          washChangedAt: submitted.washPackChanged ? timestamp : previous?.washChangedAt,
          qcChangedAt: submitted.qcPackChanged ? timestamp : previous?.qcChangedAt,
          comment: submitted.comment?.trim() || "",
        } as BloodGasRecord;
        const trackedFields: Array<keyof BloodGasRecord> = [
          "reagent", "reagentLot", "reagentExpiry", "reagentChangedAt",
          "wash", "washLot", "washExpiry", "washChangedAt",
          "qc", "qcLot", "qcExpiry", "qcChangedAt",
          "deprotein", "condition", "waste",
        ];
        if (submitted.serviceVisit) {
          trackedFields.push("serviceVisit", "serviceCompany", "serviceTechnician", "serviceWork", "servicePmPerformed");
        }
        const changes: AuditChange[] = trackedFields
          .filter((field) => String(previous?.[field] ?? "") !== String(newRec[field] ?? ""))
          .map((field) => ({ field, before: previous?.[field] ?? "", after: newRec[field] ?? "" }));
        if (newRec.comment) changes.push({ field: "comment", before: "", after: newRec.comment });

        const eventTypes: LogEventType[] = [];
        if (submitted.reagentPackChanged || submitted.washPackChanged || submitted.qcPackChanged) {
          eventTypes.push("pack_change");
        }
        if (changes.some((change) => /^(reagent|wash|qc)/.test(change.field) && !change.field.endsWith("ChangedAt"))) {
          eventTypes.push("status_update");
        }
        if (submitted.deprotein || submitted.condition) eventTypes.push("maintenance");
        if (submitted.serviceVisit) eventTypes.push("service_visit");
        if (submitted.waste === "ทิ้ง Waste") eventTypes.push("waste");
        if (newRec.comment) eventTypes.push("comment");
        if (eventTypes.length === 0) eventTypes.push("status_update");

        const logEntry: AuditLogEntry = {
          ...newRec,
          id: `mock-${Date.now()}`,
          actor: { username: "mock-user", name: newRec.worker },
          eventTypes,
          changes,
          isLegacy: false,
          schemaVersion: 2,
        };
        MOCK_DATA.records[submitted.ward] = newRec;
        MOCK_DATA.logs.unshift(logEntry);
        return MOCK_DATA.saveRecord;
      }

      if (action === 'saveServiceReport' && payload.data) {
        const submitted = payload.data as Partial<BloodGasRecord> & { ward: string; serviceWork?: string };
        if (!submitted.serviceWork?.trim()) return { success: false, message: "โปรดระบุงานที่ดำเนินการ" };
        const timestamp = new Date().toISOString();
        const logEntry: AuditLogEntry = {
          timestamp,
          ward: submitted.ward,
          worker: "ช่างบริษัท (Mock)",
          reagent: 0,
          reagentExpiry: "",
          reagentLot: "",
          wash: 0,
          washExpiry: "",
          washLot: "",
          qc: 0,
          qcExpiry: "",
          qcLot: "",
          comment: submitted.comment?.trim() || "",
          deprotein: false,
          condition: false,
          waste: "ไม่ได้ทิ้ง Waste",
          serviceVisit: true,
          serviceCompany: "บริษัทตัวอย่าง (Mock)",
          serviceTechnician: "ช่างทดสอบ (Mock)",
          serviceWork: submitted.serviceWork.trim(),
          servicePmPerformed: Boolean(submitted.servicePmPerformed),
          serviceReagentChanged: Boolean(submitted.serviceReagentChanged),
          serviceWashChanged: Boolean(submitted.serviceWashChanged),
          serviceQcChanged: Boolean(submitted.serviceQcChanged),
          id: `mock-service-${Date.now()}`,
          actor: { username: "mock-technician", name: "ช่างทดสอบ (Mock)" },
          eventTypes: submitted.comment?.trim() ? ["service_visit", "comment"] : ["service_visit"],
          changes: [],
          isLegacy: false,
          schemaVersion: 2,
        };
        MOCK_DATA.logs.unshift(logEntry);
        return { success: true, message: "บันทึกรายงานงานช่างสำเร็จ (Mock Mode)" };
      }

      if (action === 'login' && String(payload.username || "").toLowerCase() === "technician") {
        return {
          success: true,
          user: {
            username: "technician",
            fullName: "ช่างทดสอบ (Mock)",
            role: "technician",
            ward: "อายุรกรรมชาย 2",
            company: "บริษัทตัวอย่าง (Mock)",
          },
          sessionToken: "mock-technician-session",
        };
      }
      if (action === 'login') return MOCK_DATA.login;
      if (action === 'getWards') return MOCK_DATA.getWards;
      if (action === 'getLastRecord') {
        const ward = payload.ward || "";
        return { success: true, record: MOCK_DATA.records[ward] || null };
      }
      if (action === 'getLogs') {
        const ward = String(payload.ward || "");
        const query = String(payload.query || "").trim().toLowerCase();
        const eventTypes = Array.isArray(payload.eventTypes) ? payload.eventTypes.map(String) : [];
        const dateFrom = payload.dateFrom ? new Date(`${payload.dateFrom}T00:00:00`).getTime() : null;
        const dateTo = payload.dateTo ? new Date(`${payload.dateTo}T23:59:59.999`).getTime() : null;
        const onlyWithComment = payload.onlyWithComment === true;
        const filteredLogs = MOCK_DATA.logs.filter((log) => {
          const timestamp = new Date(log.timestamp).getTime();
          if (ward && log.ward !== ward) return false;
          if (dateFrom && timestamp < dateFrom) return false;
          if (dateTo && timestamp > dateTo) return false;
          if (eventTypes.length > 0 && !eventTypes.some((type) => log.eventTypes.includes(type as LogEventType))) {
            return false;
          }
          if (onlyWithComment && !log.comment.trim()) return false;
          if (query) {
            const searchable = [
              log.worker,
              log.actor.name,
              log.actor.username,
              log.reagentLot,
              log.washLot,
              log.qcLot,
              log.comment,
            ].join(" ").toLowerCase();
            if (!searchable.includes(query)) return false;
          }
          return true;
        });
        const offset = Math.max(0, Number(payload.cursor) || 0);
        const limit = Math.min(50, Math.max(1, Number(payload.limit) || 20));
        const nextOffset = offset + limit;
        return {
          success: true,
          logs: filteredLogs.slice(offset, nextOffset),
          nextCursor: nextOffset < filteredLogs.length ? String(nextOffset) : null,
          hasMore: nextOffset < filteredLogs.length,
        };
      }
      
      return { success: false, message: "No Mock Data for: " + action };
    }

    // 3. Real API Call
    try {
      const requestBody = {
        action,
        username,
        password,
        sessionToken,
        ...payload
      };

      const response = await axios.post(GAS_URL, JSON.stringify(requestBody), {
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });

      return response.data;
    } catch (error) {
      console.error(`[API Error] ${action}:`, error);
      return { success: false, message: "การเชื่อมต่อหลังบ้านผิดพลาด" };
    }
  },
};
