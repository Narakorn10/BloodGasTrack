import axios from 'axios';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL 
  ? `https://script.google.com/macros/s/${process.env.NEXT_PUBLIC_GAS_URL}/exec`
  : null;

interface BloodGasRecord {
  timestamp: string;
  ward: string;
  worker: string;
  reagent: number;
  reagentExpiry: string;
  reagentLot: string;
  wash: number;
  washExpiry: string;
  washLot: string;
  qc: number;
  qcExpiry: string;
  qcLot: string;
  comment: string;
  deprotein: boolean;
  condition: boolean;
  waste: string;
}

interface User {
  username: string;
  fullName: string;
  role: string;
  ward: string;
}

// Mock Data for local testing (matches v5.5 Backend Structure)
const MOCK_DATA: {
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

export const api = {
  async post(action: string, payload: Record<string, unknown> = {}) {
    // 1. If GAS_URL is missing, use Mock Mode
    if (!GAS_URL) {
      console.warn(`[Mock API] Action: ${action}`, payload);
      
      if (action === 'saveRecord') {
        const newRec = { 
          ...payload.data, 
          timestamp: new Date().toISOString(), 
          ward: payload.data.ward, 
          worker: payload.data.worker 
        };
        MOCK_DATA.records[payload.data.ward] = newRec;
        MOCK_DATA.logs.unshift(newRec);
        return MOCK_DATA.saveRecord;
      }

      if (action === 'login') return MOCK_DATA.login;
      if (action === 'getWards') return MOCK_DATA.getWards;
      if (action === 'getLastRecord') {
        const ward = payload.ward || "";
        return { success: true, record: MOCK_DATA.records[ward] || null };
      }
      if (action === 'getLogs') {
        const ward = payload.ward;
        const filteredLogs = ward ? MOCK_DATA.logs.filter((l: BloodGasRecord) => l.ward === ward) : MOCK_DATA.logs;
        return { success: true, logs: filteredLogs.slice(0, 20) };
      }
      
      return { success: false, message: "No Mock Data for: " + action };
    }

    // 2. Real API Call
    try {
      // Standardized request structure for v5.5 Backend
      const requestBody = {
        action: action,
        ...payload // Contains ward, username, password, or data object
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
