import axios from 'axios';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL 
  ? `https://script.google.com/macros/s/${process.env.NEXT_PUBLIC_GAS_URL}/exec`
  : null;

// Mock Data for local testing (matches v5.5 Backend Structure)
let MOCK_DATA: any = {
  getLastRecord: {
    success: true,
    record: {
      timestamp: new Date().toISOString(), ward: "อายุกรรมชาย 2", worker: "นรากร (Mock)",
      reagent: 75, reagentExpiry: "2026-12-31", reagentLot: "LOT-R-MOCK",
      wash: 42, washExpiry: "2026-08-15", washLot: "LOT-W-MOCK",
      qc: 90, qcExpiry: "2026-11-20", qcLot: "LOT-Q-MOCK",
      comment: "โหมดจำลองสถานะแอป", deprotein: true, condition: true, waste: "ไม่ได้ทิ้ง Waste"
    }
  },
  getLogs: {
    success: true,
    logs: [
      { timestamp: new Date().toISOString(), ward: "อายุกรรมชาย 2", worker: "นรากร (Mock)", reagent: 75, wash: 42, qc: 90, comment: "ระบบพร้อมใช้งาน", deprotein: true, condition: true, waste: "ไม่ได้ทิ้ง Waste" },
    ]
  },
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
  async post(action: string, payload: any = {}) {
    // 1. If GAS_URL is missing, use Mock Mode
    if (!GAS_URL) {
      console.warn(`[Mock API] Action: ${action}`, payload);
      
      if (action === 'saveRecord') {
        const newRec = { 
          ...payload.data, 
          timestamp: new Date().toLocaleString(), 
          ward: payload.data.ward, 
          worker: payload.data.worker 
        };
        MOCK_DATA.getLastRecord.record = newRec;
        MOCK_DATA.getLogs.logs.unshift(newRec);
        return MOCK_DATA.saveRecord;
      }

      if (action === 'login') return MOCK_DATA.login;
      if (action === 'getWards') return MOCK_DATA.getWards;
      if (action === 'getLastRecord') return MOCK_DATA.getLastRecord;
      if (action === 'getLogs') return MOCK_DATA.getLogs;
      
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
