export interface BloodGasRecord {
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

export interface User {
  username: string;
  fullName: string;
  role: string;
  ward?: string;
}
