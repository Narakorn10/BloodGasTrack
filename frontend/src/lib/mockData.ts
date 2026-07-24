import { AuditLogEntry, BloodGasRecord, User } from "./types";

const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

const medRecord: BloodGasRecord = {
  timestamp: hoursAgo(2),
  ward: "อายุกรรมชาย 2",
  worker: "นรากร (Mock)",
  reagent: 100,
  reagentExpiry: "2026-12-31",
  reagentLot: "LOT-R-MED-02",
  reagentChangedAt: hoursAgo(2),
  wash: 100,
  washExpiry: "2026-11-30",
  washLot: "LOT-W-MED-02",
  washChangedAt: hoursAgo(2),
  qc: 100,
  qcExpiry: "2026-10-31",
  qcLot: "LOT-Q-MED-02",
  qcChangedAt: hoursAgo(2),
  comment: "เครื่องมี Alarm หลังเปลี่ยน QC กรุณาตรวจสอบและทำ QC ซ้ำในเวรบ่าย",
  deprotein: true,
  condition: true,
  waste: "ไม่ได้ทิ้ง Waste",
};

const nicuRecord: BloodGasRecord = {
  timestamp: hoursAgo(6),
  ward: "NICU",
  worker: "พยาบาล (Mock)",
  reagent: 15,
  reagentExpiry: "2026-08-01",
  reagentLot: "LOT-R-NICU",
  wash: 88,
  washExpiry: "2026-10-10",
  washLot: "LOT-W-NICU",
  qc: 45,
  qcExpiry: "2026-09-20",
  qcLot: "LOT-Q-NICU",
  comment: "",
  deprotein: false,
  condition: true,
  waste: "ทิ้ง Waste",
};

const mockLogs: AuditLogEntry[] = [
  {
    ...medRecord,
    id: "mock-audit-001",
    actor: { username: "mock-admin", name: "นรากร (Mock)" },
    eventTypes: ["pack_change", "status_update", "maintenance", "comment"],
    changes: [
      { field: "reagent", before: 20, after: 100 },
      { field: "reagentLot", before: "LOT-R-MED-01", after: "LOT-R-MED-02" },
      { field: "reagentExpiry", before: "2026-08-31", after: "2026-12-31" },
      { field: "reagentChangedAt", before: "", after: medRecord.reagentChangedAt },
      { field: "wash", before: 15, after: 100 },
      { field: "washLot", before: "LOT-W-MED-01", after: "LOT-W-MED-02" },
      { field: "washExpiry", before: "2026-08-15", after: "2026-11-30" },
      { field: "washChangedAt", before: "", after: medRecord.washChangedAt },
      { field: "qc", before: 10, after: 100 },
      { field: "qcLot", before: "LOT-Q-MED-01", after: "LOT-Q-MED-02" },
      { field: "qcExpiry", before: "2026-07-31", after: "2026-10-31" },
      { field: "qcChangedAt", before: "", after: medRecord.qcChangedAt },
      { field: "comment", before: "", after: medRecord.comment },
    ],
    isLegacy: false,
    schemaVersion: 2,
  },
  {
    ...medRecord,
    timestamp: hoursAgo(26),
    reagent: 20,
    wash: 15,
    qc: 10,
    comment: "Reagent เหลือน้อย เตรียม Pack สำรองไว้แล้ว",
    deprotein: false,
    condition: false,
    id: "mock-audit-002",
    actor: { username: "mock-nurse", name: "พยาบาลเวรดึก (Mock)" },
    eventTypes: ["status_update", "comment"],
    changes: [
      { field: "reagent", before: 35, after: 20 },
      { field: "wash", before: 30, after: 15 },
      { field: "qc", before: 20, after: 10 },
      { field: "comment", before: "", after: "Reagent เหลือน้อย เตรียม Pack สำรองไว้แล้ว" },
    ],
    isLegacy: false,
    schemaVersion: 2,
  },
  {
    ...medRecord,
    timestamp: hoursAgo(50),
    reagent: 35,
    wash: 30,
    qc: 20,
    comment: "",
    deprotein: true,
    condition: true,
    waste: "ทิ้ง Waste",
    id: "mock-audit-003",
    actor: { username: "", name: "ข้อมูลเดิม" },
    eventTypes: ["maintenance", "waste"],
    changes: [],
    isLegacy: true,
    schemaVersion: 0,
  },
];

export const MOCK_DATA: {
  records: Record<string, BloodGasRecord>;
  logs: AuditLogEntry[];
  saveRecord: { success: boolean; message: string };
  login: { success: boolean; user: User };
  getWards: { success: boolean; wards: string[] };
} = {
  records: {
    "อายุกรรมชาย 2": medRecord,
    NICU: nicuRecord,
  },
  logs: mockLogs,
  saveRecord: { success: true, message: "บันทึกสำเร็จ (Mock Mode)" },
  login: {
    success: true,
    user: { username: "admin", fullName: "ผู้ดูแลระบบ (Mock)", role: "admin", ward: "" },
  },
  getWards: {
    success: true,
    wards: ["อายุกรรมชาย 2", "NICU", "ICU(MED)"],
  },
};
