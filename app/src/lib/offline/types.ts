// Client-sichere Typen für Offline-Betrieb (IndexedDB-Outbox, Upload-Queue, Konflikte).

export type OutboxKind = "note" | "status";

export type OutboxItem = {
  id: string;
  kind: OutboxKind;
  incidentId: string;
  incidentNo: number | null;
  body?: string; // note
  status?: string; // status
  baseUpdatedAt: string | null; // für Konflikterkennung
  createdAt: number;
  attempts: number;
  error: string | null;
};

export type UploadStatus = "pending" | "uploading" | "error";

export type UploadItem = {
  id: string;
  incidentId: string;
  incidentNo: number | null;
  category: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: number;
  attempts: number;
  status: UploadStatus;
  progress: number; // 0..100
  error: string | null;
};

export type Conflict = {
  id: string;
  incidentId: string;
  incidentNo: number | null;
  message: string;
  serverUpdatedAt: string | null;
  createdAt: number;
};

export type OfflineState = {
  online: boolean;
  syncing: boolean;
  pending: number; // Outbox (Notizen/Status)
  uploads: number; // Upload-Warteschlange
  conflicts: number;
  lastSync: number | null;
};
