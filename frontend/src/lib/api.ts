import axios from 'axios';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL 
  ? `https://script.google.com/macros/s/${process.env.NEXT_PUBLIC_GAS_URL}/exec`
  : null;

// Mock Data for local testing
let MOCK_DATA: any = {
  getLastRecord: {
    success: true,
    record: {
      timestamp: new Date().toISOString(),
      ward: "อายุกรรมชาย 2",
      worker: "นรากร (Mock)",
      reagent: 75.5,
      reagentExpiry: "2026-12-31",
      reagentLot: "LOT12345",
      wash: 42.0,
      washExpiry: "2026-08-15",
      washLot: "LOT67890",
      qc: 90.0,
      qcExpiry: "2026-11-20",
      qcLot: "QC-ABC-DE",
      comment: "น้ำยาใกล้หมดในเดือนหน้า เตรียมเบิกเพิ่ม",
      deprotein: true,
      condition: true,
      waste: "ไม่ได้ทิ้ง Waste"
    }
  },
  getLogs: {
    success: true,
    logs: [
      { timestamp: new Date().toISOString(), ward: "อายุกรรมชาย 2", worker: "นรากร (Mock)", reagent: 75.5, wash: 42, qc: 90, comment: "ทดสอบระบบใหม่", reagentExpiry: "2026-12-31", washExpiry: "2026-08-15", qcExpiry: "2026-11-20", deprotein: true, condition: true, waste: "ไม่ได้ทิ้ง Waste" },
    ]
  },
  saveRecord: {
    success: true,
    message: "บันทึกสำเร็จ (Mock Mode)"
  },
  login: {
    success: false,
    message: "ระบบกำลังทำงานใน Mock Mode กรุณาตั้งค่า GAS_URL เพื่อใช้งานจริง"
  },
  getWards: {
    success: true,
    wards: ["อายุกรรมชาย 2", "NICU", "ICU(MED)"]
  }
};

export const api = {
  async post(action: string, data: any = {}) {
    if (!GAS_URL) {
      console.warn(`⚠️ GAS_URL is not set. Returning Mock Data for: ${action}`);
      
      // Simulate real behavior for Mock Mode
      if (action === 'saveRecord') {
        const newRecord = {
          ...data.data,
          timestamp: new Date().toISOString(),
          ward: data.ward,
          worker: data.worker,
        };
        MOCK_DATA.getLastRecord.record = newRecord;
        MOCK_DATA.getLogs.logs.unshift(newRecord);
        return { success: true, message: "บันทึกสำเร็จ (Mock DB updated)" };
      }

      if (action === 'getLastRecord') {
        // Just return the latest mock record, ignore ward for simplicity in mock
        return MOCK_DATA.getLastRecord;
      }

      return MOCK_DATA[action] || { success: false, message: "No Mock Data" };
    }

    try {
      const response = await axios.post(GAS_URL, JSON.stringify({ action, ...data }), {
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
      });
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      // For sensitive actions like login, do NOT fall back to mock data
      if (action === 'login') {
        return { success: false, message: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้" };
      }
      return MOCK_DATA[action as keyof typeof MOCK_DATA] || { success: false, message: "API Error & No Mock Data" };
    }
  },
};
