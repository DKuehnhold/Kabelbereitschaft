"use client";

// Zentrale Offline-Synchronisation (Singleton). Verwaltet Outbox (Notizen/Status),
// Upload-Warteschlange (Bilder), Konflikte und Deduplizierung; synchronisiert automatisch.
// Benutzertrennung über ownerId; Idempotenz über stabile Aktions-IDs (client_action_id).
import {
  outboxList, outboxPut, outboxDelete,
  uploadsList, uploadsPut, uploadsDelete,
  conflictsList, conflictsPut, conflictsDelete,
  kvGet, kvSet,
} from "@/lib/offline/db";
import type { OfflineState, OutboxItem, UploadItem, Conflict } from "@/lib/offline/types";

const DEFAULT_STATE: OfflineState = {
  online: true, syncing: false, pending: 0, uploads: 0, failed: 0, conflicts: 0, lastSync: null, swActive: false,
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
  private userId: string | null = null;

  subscribe = (cb: Listener): (() => void) => { this.listeners.add(cb); return () => this.listeners.delete(cb); };
  getSnapshot = (): OfflineState => this.state;
  getServerSnapshot = (): OfflineState => DEFAULT_STATE;
  getUploads = (): UploadItem[] => this.uploadsMem;
  getConflicts = (): Conflict[] => this.conflictsMem;

  private mine<T extends { ownerId: string }>(arr: T[]): T[] {
    return this.userId ? arr.filter((a) => a.ownerId === this.userId) : arr;
  }
  private emit(patch: Partial<OfflineState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  async init(userId?: string | null) {
    if (userId !== undefined && userId !== null) this.userId = userId;
    if (this.initialized || typeof window === "undefined") { await this.refresh(); return; }
    this.initialized = true;
    this.emit({ online: navigator.onLine, swActive: !!navigator.serviceWorker?.controller });
    window.addEventListener("online", () => { this.emit({ online: true }); void this.flush(); });
    window.addEventListener("offline", () => this.emit({ online: false }));
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("controllerchange", () =>
        this.emit({ swActive: !!navigator.serviceWorker.controller }));
    }
    await this.refresh();
    if (navigator.onLine) void this.flush();
  }

  // Benutzerbezug setzen (Trennung auf gemeinsam genutzten Geräten). Löscht nichts.
  async setUser(userId: string | null) {
    if (this.userId === userId) return;
    this.userId = userId;
    await this.refresh();
  }

  private async refresh() {
    const [obAll, upAll, cfAll, last] = await Promise.all([
      outboxList(), uploadsList(), conflictsList(), kvGet<number>("lastSync"),
    ]);
    const ob = this.mine(obAll);
    const up = this.mine(upAll);
    const cf = this.mine(cfAll);
    this.uploadsMem = up.sort((a, b) => a.createdAt - b.createdAt);
    this.conflictsMem = cf.sort((a, b) => b.createdAt - a.createdAt);
    const failed = ob.filter((i) => i.attempts > 0 || i.error).length + up.filter((u) => u.status === "error").length;
    this.emit({
      pending: ob.length, uploads: up.length, failed, conflicts: cf.length, lastSync: last,
      swActive: typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller,
    });
  }

  // ---- Enqueue ----
  async enqueueNote(incidentId: string, incidentNo: number | null, body: string) {
    const item: OutboxItem = {
      id: uid(), ownerId: this.userId ?? "", kind: "note", incidentId, incidentNo, body,
      baseUpdatedAt: null, createdAt: Date.now(), attempts: 0, error: null,
    };
    await outboxPut(item); await this.refresh(); if (this.state.online) void this.flush();
  }
  async enqueueStatus(incidentId: string, incidentNo: number | null, status: string, baseUpdatedAt: string | null) {
    const item: OutboxItem = {
      id: uid(), ownerId: this.userId ?? "", kind: "status", incidentId, incidentNo, status,
      baseUpdatedAt, createdAt: Date.now(), attempts: 0, error: null,
    };
    await outboxPut(item); await this.refresh(); if (this.state.online) void this.flush();
  }
  async enqueueUpload(p: { incidentId: string; incidentNo: number | null; category: string; description: string | null; file: File; }) {
    const item: UploadItem = {
      id: uid(), ownerId: this.userId ?? "", incidentId: p.incidentId, incidentNo: p.incidentNo,
      category: p.category, description: p.description, fileName: p.file.name,
      mimeType: p.file.type || "application/octet-stream", size: p.file.size, blob: p.file,
      createdAt: Date.now(), attempts: 0, status: "pending", progress: 0, error: null,
    };
    await uploadsPut(item); await this.refresh(); if (this.state.online) void this.flush();
  }

  // ---- Queue/Konflikt-Steuerung ----
  async cancelUpload(id: string) {
    if (this.currentXhr && this.uploadsMem.find((u) => u.id === id && u.status === "uploading")) this.currentXhr.abort();
    await uploadsDelete(id); await this.refresh();
  }
  async clearConflict(id: string) { await conflictsDelete(id); await this.refresh(); }
  retry() { void this.flush(); }

  // Konfliktauflösung: lokale Statusänderung auf Basis des aktuellen Serverstands erneut anwenden.
  async reapplyStatusConflict(c: Conflict) {
    if (c.kind !== "status" || !c.attemptedStatus) { await this.clearConflict(c.id); return; }
    let base: string | null = null;
    try {
      const res = await fetch(`/api/incidents/${c.incidentId}/meta`, { cache: "no-store" });
      if (res.ok) { const d = (await res.json()) as { updated_at?: string | null }; base = d.updated_at ?? null; }
    } catch { /* offline – dann ohne frischen Basiswert erneut versuchen */ }
    await this.enqueueStatus(c.incidentId, c.incidentNo, c.attemptedStatus, base);
    await this.clearConflict(c.id);
  }

  // ---- Synchronisation ----
  async flush() {
    if (typeof navigator === "undefined" || !navigator.onLine || this.state.syncing) return;
    this.emit({ syncing: true });
    try { await this.flushOutbox(); await this.flushUploads(); await kvSet("lastSync", Date.now()); }
    finally { await this.refresh(); this.emit({ syncing: false }); }
  }

  private async flushOutbox() {
    const items = this.mine(await outboxList());
    if (items.length === 0) return;
    let res: Response;
    try {
      res = await fetch("/api/sync", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.id, clientActionId: i.id, kind: i.kind, incidentId: i.incidentId,
            body: i.body, status: i.status, baseUpdatedAt: i.baseUpdatedAt,
          })),
        }),
      });
    } catch { return; }
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
          id: uid(), ownerId: item.ownerId, incidentId: item.incidentId, incidentNo: item.incidentNo,
          kind: item.kind, attemptedStatus: item.status ?? null,
          message: r.message ?? "Konflikt", serverUpdatedAt: r.serverUpdatedAt ?? null, createdAt: Date.now(),
        };
        await conflictsPut(c);
        await outboxDelete(item.id); // dokumentiert, keine stille Überschreibung
      } else {
        item.attempts += 1; item.error = r.message ?? "Fehler";
        await outboxPut(item);
        // Permanenter Validierungsfehler: nach mehreren Versuchen nicht endlos wiederholen.
        if (item.attempts >= 5) { /* bleibt als Fehler sichtbar, kein Auto-Retry mehr */ }
      }
    }
  }

  private async flushUploads() {
    const items = this.mine(await uploadsList()).filter((u) => u.status !== "uploading" && u.attempts < 5);
    for (const item of items) {
      try { await this.uploadOne(item); await uploadsDelete(item.id); }
      catch (e) {
        item.status = "error"; item.attempts += 1;
        item.error = e instanceof Error ? e.message : "Upload fehlgeschlagen"; item.progress = 0;
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
      fd.set("client_action_id", item.id); // Idempotenz
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
