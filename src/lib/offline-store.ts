import {
  notifyOfflineQueueChanged,
  type CachedSession,
  type JournalCache,
  type QueuedLog,
} from "./offline";

export type OfflineBackend = {
  listPending(): Promise<QueuedLog[]>;
  getPending(id: string): Promise<QueuedLog | null>;
  putPending(item: QueuedLog): Promise<void>;
  deletePending(id: string): Promise<void>;
  getPhoto(id: string): Promise<Blob | null>;
  putPhoto(id: string, blob: Blob): Promise<void>;
  deletePhoto(id: string): Promise<void>;
  getJournal(): Promise<JournalCache | null>;
  putJournal(cache: JournalCache): Promise<void>;
  getSession(): Promise<CachedSession | null>;
  putSession(session: CachedSession): Promise<void>;
  listManualEntryIds(): Promise<string[]>;
  addManualEntryId(id: string): Promise<void>;
  removeManualEntryId(id: string): Promise<void>;
};

const DB_NAME = "tide-mark-offline";
const DB_VERSION = 1;

export function memoryOfflineBackend(): OfflineBackend {
  const pending = new Map<string, QueuedLog>();
  const photos = new Map<string, Blob>();
  let journal: JournalCache | null = null;
  let session: CachedSession | null = null;
  const manual = new Set<string>();
  return {
    async listPending() {
      return [...pending.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    async getPending(id) {
      return pending.get(id) ?? null;
    },
    async putPending(item) {
      pending.set(item.id, item);
    },
    async deletePending(id) {
      pending.delete(id);
    },
    async getPhoto(id) {
      return photos.get(id) ?? null;
    },
    async putPhoto(id, blob) {
      photos.set(id, blob);
    },
    async deletePhoto(id) {
      photos.delete(id);
    },
    async getJournal() {
      return journal;
    },
    async putJournal(cache) {
      journal = cache;
    },
    async getSession() {
      return session;
    },
    async putSession(next) {
      session = next;
    },
    async listManualEntryIds() {
      return [...manual];
    },
    async addManualEntryId(id) {
      manual.add(id);
    },
    async removeManualEntryId(id) {
      manual.delete(id);
    },
  };
}

function idbOfflineBackend(): OfflineBackend {
  let opener: Promise<IDBDatabase> | null = null;

  function openDb(): Promise<IDBDatabase> {
    if (opener) return opener;
    opener = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("pending")) db.createObjectStore("pending", { keyPath: "id" });
        if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos");
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    });
    return opener;
  }

  async function withStore<T>(
    store: string,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
  ): Promise<T> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const result = run(tx.objectStore(store));
      if (result instanceof Promise) {
        result.then(resolve, reject);
        return;
      }
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error ?? new Error("IndexedDB request failed"));
    });
  }

  return {
    async listPending() {
      const rows = await withStore<QueuedLog[]>("pending", "readonly", (store) => store.getAll());
      return (rows ?? []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    async getPending(id) {
      return (await withStore<QueuedLog | undefined>("pending", "readonly", (store) => store.get(id))) ?? null;
    },
    async putPending(item) {
      await withStore("pending", "readwrite", (store) => store.put(item));
    },
    async deletePending(id) {
      await withStore("pending", "readwrite", (store) => store.delete(id));
    },
    async getPhoto(id) {
      return (await withStore<Blob | undefined>("photos", "readonly", (store) => store.get(id))) ?? null;
    },
    async putPhoto(id, blob) {
      await withStore("photos", "readwrite", (store) => store.put(blob, id));
    },
    async deletePhoto(id) {
      await withStore("photos", "readwrite", (store) => store.delete(id));
    },
    async getJournal() {
      return (await withStore<JournalCache | undefined>("kv", "readonly", (store) => store.get("journal"))) ?? null;
    },
    async putJournal(cache) {
      await withStore("kv", "readwrite", (store) => store.put(cache, "journal"));
    },
    async getSession() {
      return (await withStore<CachedSession | undefined>("kv", "readonly", (store) => store.get("session"))) ?? null;
    },
    async putSession(session) {
      await withStore("kv", "readwrite", (store) => store.put(session, "session"));
    },
    async listManualEntryIds() {
      return (await withStore<string[] | undefined>("kv", "readonly", (store) => store.get("manual-entry"))) ?? [];
    },
    async addManualEntryId(id) {
      const current = await this.listManualEntryIds();
      if (current.includes(id)) return;
      await withStore("kv", "readwrite", (store) => store.put([...current, id], "manual-entry"));
    },
    async removeManualEntryId(id) {
      const current = await this.listManualEntryIds();
      await withStore("kv", "readwrite", (store) =>
        store.put(
          current.filter((item) => item !== id),
          "manual-entry",
        ),
      );
    },
  };
}

let backend: OfflineBackend =
  typeof indexedDB === "undefined" ? memoryOfflineBackend() : idbOfflineBackend();

export function getOfflineBackend() {
  return backend;
}

export function useOfflineBackend(next: OfflineBackend) {
  backend = next;
}

export function resetOfflineBackend() {
  backend = typeof indexedDB === "undefined" ? memoryOfflineBackend() : idbOfflineBackend();
}

export async function listQueuedLogs() {
  return backend.listPending();
}

export async function getQueuedLog(id: string) {
  return backend.getPending(id);
}

export async function saveQueuedLog(item: QueuedLog) {
  await backend.putPending(item);
  notifyOfflineQueueChanged();
}

export async function removeQueuedLog(id: string) {
  await backend.deletePending(id);
  await backend.deletePhoto(id);
  notifyOfflineQueueChanged();
}

export async function getQueuedPhoto(id: string) {
  return backend.getPhoto(id);
}

export async function saveQueuedPhoto(id: string, blob: Blob) {
  await backend.putPhoto(id, blob);
}

export async function readJournalCache() {
  return backend.getJournal();
}

export async function writeJournalCache(cache: JournalCache) {
  await backend.putJournal(cache);
}

export async function readCachedSession() {
  return backend.getSession();
}

export async function writeCachedSession(session: CachedSession) {
  await backend.putSession(session);
}

export async function listManualEntryCatchIds() {
  return backend.listManualEntryIds();
}

export async function markManualEntryCatch(id: string) {
  await backend.addManualEntryId(id);
}

export async function clearManualEntryCatch(id: string) {
  await backend.removeManualEntryId(id);
}
