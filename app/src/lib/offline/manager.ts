"use client";

// Zentrale Offline-Synchronisation (Singleton). Verwaltet Outbox (Notizen/Status),
// Upload-Warteschlange (Bilder) und Konflikte; synchronisiert automatisch bei Verbindung.
import {
  outboxList, outboxPut, outboxDelete,
  uploadsList, uploadsPut, uploadsDelete,
  conflictsList, conflictsPut, conflictsDelete,
  kvGet, kvSet,
} from "@/lib/offline/db";
import type { OfflineState, OutboxItem, UploadItem, Conflict } from "@/lib/offline/types";

const DEFAULT_STATE: OfflineState = {
  online: true, syncing: false, pending: 0, uploads: 0, conflicts: 0, lastSync: null,
};

type Listener = () => void;

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());

class OfflineManager {
  private state: OfflineState = DEFAULT_STATE;
  private uploadsMem: UploadItem[] = [];
  private conflictsMem: Conflict[] = [];
  private listeners = new Set<Listener>();
  private initialized = false;
  private currentXhr: XMLHttpRequest | null = null;

  subscribe = (cb: Listener): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = (): OfflineState => this.state;
  getServerSnapshot = (): OfflineState => DEFAULT_STATE;
  getUploads = (): UploadItem[] => this.uploadsMem;
  getConflicts = (): Conflict[] => this.conflictsMem;

  private emit(patch: Partial<OfflineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  async init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    this.emit({ online: navigator.onLine });
    window.addEventListener("online", () => { this.emit({ online: true }); void this.flush(); });
    window.addEventListener("offline", () => this.emit({ online: false }));
    await this.refresh();
    if (navigator.onLine) void this.flush();
  }

  private async refresh() {
    const [ob, up, cf, last] = await Promise.all([
      outboxList(), uploadsList(), conflictsList(), kvGet<number>("lastSync"),
    ]);
    this.uploadsMem = up.sort((a, b) => a.createdAt - b.createdAt);
    this.conflictsMem = cf.sort((a, b) => b.createdAt - a.createdAt);
    this.emit({ pending: ob.length, uploads: up.length, conflicts: cf.length, lastSync: last });
  }

  // ---- Enqueue ----
  async enqueueNote(incidentId: string, incidentNo: number | null, body: string) {
    const item: OutboxItem = {
      id: uid(), kind: "note", incidentId, incidentNo, body,
      baseUpdatedAt: null, createdAt: Date.now(), attempts: 0, error: null,
    };
    await outboxPut(item);
    await this.refresh();
    if (this.state.online) void this.flush();
  }
  async enqueueStatus(incidentId: string, incidentNo: number | null, status: string, baseUpdatedAt: string | null) {
    const item: OutboxItem = {
      id: uid(), kind: "status", incidentId, incidentNo, status,
      baseUpdatedAt, createdAt: Date.now(), attempts: 0, error: null,
    };
    await outboxPut(item);
    await this.refresh();
    if (this.state.online) void this.flush();
  }
  async enqueueUpload(p: {
    incidentId: string; incidentNo: number | null; category: string;
    description: string | null; file: File;
  }) {
    const item: UploadItem = {
      id: uid(), incidentId: p.incidentId, incidentNo: p.incidentNo, category: p.category,
      description: p.description, fileName: p.file.name, mimeType: p.file.type || "application/octet-stream",
      size: p.file.size, blob: p.file, createdAt: Date.now(), attempts: 0,
      status: "pending", progress: 0, error: null,
    };
    await uploadsPut(item);
    await this.refresh();
    if (this.state.online) void this.flush();
  }

  // ---- Queue-Steuerung ----
  async cancelUpload(id: string) {
    if (this.currentXhr && this.uploadsMem.find((u) => u.id === id && u.status === "uploading")) {
      this.currentXhr.abort();
    }
    await uploadsDelete(id);
    await this.refresh();
  }
  async clearConflict(id: string) {
    await conflictsDelete(id);
    await this.refresh();
  }
  retry() { void this.flush(); }

  // ---- Synchronisation ----
  async flush() {
    if (typeof navigator === "undefined" || !navigator.onLine || this.state.syncing) return;
    this.emit({ syncing: true });
    try {
      await this.flushOutbox();
      await this.flushUploads();
      await kvSet("lastSync", Date.now());
    } finally {
      await this.refresh();
      this.emit({ syncing: false });
    }
  }

  private async flushOutbox() {
    const items = await outboxList();
    if (items.length === 0) return;
    let res: Response;
    try {
      res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.id, kind: i.kind, incidentId: i.incidentId,
            body: i.body, status: i.status, baseUpdatedAt: i.baseUpdatedAt,
          })),
        }),
      });
    } catch {
      return; // offline geworden – beim nächsten Mal erneut
    }
    if (!res.ok) return;
    const data = (await res.json()) as {
      results?: { id: string; result: "applied" | "conflict" | "error"; message?: string; serverUpdatedAt?: string | null }[];
    };
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const r of data.results ?? []) {
      const item = byId.get(r.id);
      if (!item) continue;
      if (r.result === "applied") {
        await outboxDelete(item.id);
      } else if (r.result === "conflict") {
        const c: Conflict = {
          id: uid(), incidentId: item.incidentId, incidentNo: item.incidentNo,
          message: r.message ?? "Konflikt", serverUpdatedAt: r.serverUpdatedAt ?? null, createdAt: Date.now(),
        };
        await conflictsPut(c);
        await outboxDelete(item.id); // Konflikt dokumentiert, keine stille Überschreibung
      } else {
        item.attempts += 1;
        item.error = r.message ?? "Fehler";
        await outboxPut(item);
      }
    }
  }

  private async flushUploads() {
    const items = (await uploadsList()).filter((u) => u.status !== "uploading");
    for (const item of items) {
      try {
        await this.uploadOne(item);
        await uploadsDelete(item.id);
      } catch (e) {
        item.status = "error";
        item.attempts += 1;
        item.error = e instanceof Error ? e.message : "Upload fehlgeschlagen";
        item.progress = 0;
        await uploadsPut(item);
      }
      await this.refresh();
    }
  }

  private uploadOne(item: UploadItem): Promise<void> {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.set("incident_id", item.incidentId);
      fd.set("category", item.category);
      if (item.description) fd.set("description", item.description);
      fd.append("files", item.blob, item.fileName);

      const xhr = new XMLHttpRequest();
      this.currentXhr = xhr;
      xhr.open("POST", "/api/images/upload");
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const idx = this.uploadsMem.findIndex((u) => u.id === item.id);
          if (idx >= 0) {
            this.uploadsMem[idx] = { ...this.uploadsMem[idx], status: "uploading", progress: Math.round((ev.loaded / ev.total) * 100) };
            this.listeners.forEach((l) => l());
          }
        }
      };
      xhr.onload = () => {
        this.currentXhr = null;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`HTTP ${xhr.status}`));
      };
      xhr.onerror = () => { this.currentXhr = null; reject(new Error("Netzwerkfehler")); };
      xhr.onabort = () => { this.currentXhr = null; reject(new Error("Abgebrochen")); };
      xhr.send(fd);
    });
  }
}

export const offlineManager = new OfflineManager();
