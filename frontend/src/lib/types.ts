export interface BloodGasRecord {
  timestamp: string;
  ward: string;
  worker: string;
  reagent: number;
  reagentExpiry: string;
  reagentLot: string;
  reagentPackChanged?: boolean;
  wash: number;
  washExpiry: string;
  washLot: string;
  washPackChanged?: boolean;
  qc: number;
  qcExpiry: string;
  qcLot: string;
  qcPackChanged?: boolean;
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
  sessionToken?: string;
}
