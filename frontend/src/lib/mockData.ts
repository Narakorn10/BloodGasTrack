import { BloodGasRecord, User } from './types';

// Mock Data for local testing (matches v5.5 Backend Structure)
export const MOCK_DATA: {
  records: Record<string, BloodGasRecord>;
  logs: BloodGasRecord[];
  saveRecord: { success: boolean; message: string };
  login: { success: boolean; user: User };
  getWards: { success: boolean; wards: string[] };
} = {
  records: {
    "อายุกรรมชาย 2": {
      timestamp: new Date().toISOString(), ward: "อายุกรรมชาย 2", worker: "นรากร (Mock)",
      reagent: 75, reagentExpiry: "2026-12-31", reagentLot: "LOT-R-MED",
      wash: 42, washExpiry: "2026-08-15", washLot: "LOT-W-MED",
      qc: 90, qcExpiry: "2026-11-20", qcLot: "LOT-Q-MED",
      comment: "ข้อมูลจำลองตึกอายุกรรม", deprotein: true, condition: true, waste: "ไม่ได้ทิ้ง Waste"
    },
    "NICU": {
      timestamp: new Date().toISOString(), ward: "NICU", worker: "พยาบาล (Mock)",
      reagent: 15, reagentExpiry: "2026-06-01", reagentLot: "LOT-R-NICU",
      wash: 88, washExpiry: "2026-10-10", washLot: "LOT-W-NICU",
      qc: 45, qcExpiry: "2026-07-20", qcLot: "LOT-Q-NICU",
      comment: "ข้อมูลจำลองตึกเด็กแรกเกิด", deprotein: false, condition: true, waste: "ทิ้ง Waste"
    }
  },
  logs: [],
  saveRecord: { success: true, message: "บันทึกสำเร็จ (Mock Mode)" },
  login: {
    success: true,
    user: { username: "admin", fullName: "ผู้ดูแลระบบ (Mock)", role: "admin", ward: "" }
  },
  getWards: {
    success: true,
    wards: ["อายุกรรมชาย 2", "NICU", "ICU(MED)"]
  }
};
