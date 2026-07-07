import axios from 'axios';
import { MOCK_DATA } from './mockData';
import { BloodGasRecord } from './types';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL 
  ? `https://script.google.com/macros/s/${process.env.NEXT_PUBLIC_GAS_URL}/exec`
  : null;

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
        const newRec: BloodGasRecord = {
          ...payload.data, 
          timestamp: new Date().toISOString(), 
          ward: payload.data.ward, 
          worker: payload.data.worker 
        } as BloodGasRecord;
        MOCK_DATA.records[payload.data.ward as string] = newRec;
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
        const filteredLogs = ward ? MOCK_DATA.logs.filter((log) => log.ward === ward) : MOCK_DATA.logs;
        return { success: true, logs: filteredLogs.slice(0, 20) };
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
