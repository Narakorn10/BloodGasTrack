export interface BloodGasRecord {
  timestamp: string;
  ward: string;
  worker: string;
  reagent: number;
  reagentExpiry: string;
  reagentLot: string;
  reagentChangedAt?: string;
  reagentPackChanged?: boolean;
  wash: number;
  washExpiry: string;
  washLot: string;
  washChangedAt?: string;
  washPackChanged?: boolean;
  qc: number;
  qcExpiry: string;
  qcLot: string;
  qcChangedAt?: string;
  qcPackChanged?: boolean;
  serviceVisit?: boolean;
  serviceCompany?: string;
  serviceTechnician?: string;
  serviceWork?: string;
  servicePmPerformed?: boolean;
  serviceReagentChanged?: boolean;
  serviceWashChanged?: boolean;
  serviceQcChanged?: boolean;
  comment: string;
  deprotein: boolean;
  condition: boolean;
  waste: string;
}

export type LogEventType =
  | "status_update"
  | "pack_change"
  | "maintenance"
  | "service_visit"
  | "waste"
  | "comment";

export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface AuditLogEntry extends BloodGasRecord {
  id: string;
  actor: {
    username: string;
    name: string;
  };
  eventTypes: LogEventType[];
  changes: AuditChange[];
  isLegacy: boolean;
  schemaVersion?: number;
}

export interface LogQuery {
  ward: string;
  dateFrom?: string;
  dateTo?: string;
  eventTypes?: LogEventType[];
  onlyWithComment?: boolean;
  query?: string;
  limit?: number;
  cursor?: string;
}

export interface LogsResponse {
  success: boolean;
  logs: AuditLogEntry[];
  nextCursor: string | null;
  hasMore: boolean;
  message?: string;
}

export interface User {
  username: string;
  fullName: string;
  role: string;
  ward?: string;
  company?: string;
  sessionToken?: string;
}
