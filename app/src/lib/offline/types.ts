// Client-sichere Typen für Offline-Betrieb (IndexedDB-Outbox, Upload-Queue, Konflikte).
// Jede Aktion trägt eine stabile `id` (= Idempotenz-/Client-Action-ID) und einen `ownerId`
// (Benutzertrennung auf gemeinsam genutzten Geräten).

export type OutboxKind = "note" | "status";

export type OutboxItem = {
  id: string; // stabile Idempotenz-ID
  ownerId: string; // Benutzertrennung
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
  id: string; // stabile Idempotenz-ID
  ownerId: string;
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
  ownerId: string;
  incidentId: string;
  incidentNo: number | null;
  kind: OutboxKind;
  attemptedStatus: string | null; // lokaler Wert (bei Statuskonflikt)
  message: string;
  serverUpdatedAt: string | null;
  createdAt: number;
};

export type OfflineState = {
  online: boolean;
  syncing: boolean;
  pending: number; // Outbox (Notizen/Status)
  uploads: number; // Upload-Warteschlange
  failed: number; // fehlgeschlagene Aktionen (Retry nötig)
  conflicts: number;
  lastSync: number | null;
  swActive: boolean; // Service Worker kontrolliert die Seite
};
