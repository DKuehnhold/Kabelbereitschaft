// Minimaler IndexedDB-Wrapper (ohne Third-Party-Libs) für den Offline-Betrieb.
// Stores: outbox (Notizen/Status), uploads (Bild-Blobs), conflicts, kv (z. B. lastSync).
// Sicherheit: hier werden AUSSCHLIESSLICH fachliche Daten und eigene Warteschlangen
// gespeichert – niemals Tokens, Session, Secrets oder Service-Keys.
import type { OutboxItem, UploadItem, Conflict } from "@/lib/offline/types";

const DB_NAME = "kb-offline";
const DB_VERSION = 1;
type StoreName = "outbox" | "uploads" | "conflicts" | "kv";

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
      if (!db.objectStoreNames.contains("uploads")) db.createObjectStore("uploads", { keyPath: "id" });
      if (!db.objectStoreNames.contains("conflicts")) db.createObjectStore("conflicts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

function getAll<T>(store: StoreName): Promise<T[]> {
  if (!hasIDB()) return Promise.resolve([]);
  return tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
}
function put<T>(store: StoreName, value: T): Promise<IDBValidKey> {
  if (!hasIDB()) return Promise.resolve("" as IDBValidKey);
  return tx<IDBValidKey>(store, "readwrite", (s) => s.put(value as unknown as object) as IDBRequest<IDBValidKey>);
}
function del(store: StoreName, key: IDBValidKey): Promise<undefined> {
  if (!hasIDB()) return Promise.resolve(undefined);
  return tx<undefined>(store, "readwrite", (s) => s.delete(key) as unknown as IDBRequest<undefined>);
}

// ---- Outbox (Notizen/Status) ----
export const outboxList = () => getAll<OutboxItem>("outbox");
export const outboxPut = (i: OutboxItem) => put("outbox", i);
export const outboxDelete = (id: string) => del("outbox", id);

// ---- Uploads (Bild-Warteschlange) ----
export const uploadsList = () => getAll<UploadItem>("uploads");
export const uploadsPut = (i: UploadItem) => put("uploads", i);
export const uploadsDelete = (id: string) => del("uploads", id);

// ---- Konflikte ----
export const conflictsList = () => getAll<Conflict>("conflicts");
export const conflictsPut = (c: Conflict) => put("conflicts", c);
export const conflictsDelete = (id: string) => del("conflicts", id);

// ---- Key-Value (lastSync etc.) ----
export async function kvGet<T>(key: string): Promise<T | null> {
  if (!hasIDB()) return null;
  const row = await tx<{ key: string; value: T } | undefined>("kv", "readonly", (s) => s.get(key) as IDBRequest<{ key: string; value: T } | undefined>);
  return row ? row.value : null;
}
export function kvSet<T>(key: string, value: T): Promise<IDBValidKey> {
  return put("kv", { key, value });
}
