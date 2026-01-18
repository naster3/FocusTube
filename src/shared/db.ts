// Base de datos en IndexedDB para guardar data (eventos + agregados diarios).
// En extensiones Chrome MV3, IndexedDB funciona tanto en service worker como en pages.

export type DbEventType = "attempt" | "time" | "blocked_time" | "session_start";

export type DbEvent = {
  id?: number;
  ts: number;
  day: string; // YYYY-MM-DD
  type: DbEventType;
  domain?: string | null;
  url?: string | null;
  deltaSec?: number | null;
  tabId?: number | null;
};

export type DailyStats = {
  day: string;
  attempts: number;
  time: number;
  blockedTime: number;
  sessions: number;
  timeByDomain: Record<string, number>;
  updatedAt: number;
};

export type DailyDelta = {
  attempts?: number;
  time?: number;
  blockedTime?: number;
  sessions?: number;
  timeByDomain?: Record<string, number>;
  updatedAt?: number;
};

const DB_NAME = "focus-tube-blocker";
const DB_VERSION = 1;
const STORE_EVENTS = "events";
const STORE_DAILY = "daily_stats";

let dbPromise: Promise<IDBDatabase> | null = null;

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request error"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("IndexedDB tx aborted"));
    tx.onerror = () => reject(tx.error || new Error("IndexedDB tx error"));
  });
}

async function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // events: log detallado.
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const store = db.createObjectStore(STORE_EVENTS, { keyPath: "id", autoIncrement: true });
        store.createIndex("by_ts", "ts", { unique: false });
        store.createIndex("by_day", "day", { unique: false });
        store.createIndex("by_type", "type", { unique: false });
        store.createIndex("by_domain", "domain", { unique: false });
      }

      // daily_stats: agregados por dia (rapido para dashboards).
      if (!db.objectStoreNames.contains(STORE_DAILY)) {
        const store = db.createObjectStore(STORE_DAILY, { keyPath: "day" });
        store.createIndex("by_updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open error"));
  });

  return dbPromise;
}

export async function ensureDbReady() {
  await openDb();
}

function defaultDaily(day: string, now: number): DailyStats {
  return {
    day,
    attempts: 0,
    time: 0,
    blockedTime: 0,
    sessions: 0,
    timeByDomain: {},
    updatedAt: now
  };
}

export async function flushToDb(events: Omit<DbEvent, "id">[], dailyDeltas: Map<string, DailyDelta>) {
  if (events.length === 0 && dailyDeltas.size === 0) {
    return;
  }

  const db = await openDb();
  const tx = db.transaction([STORE_EVENTS, STORE_DAILY], "readwrite");
  const eventStore = tx.objectStore(STORE_EVENTS);
  const dailyStore = tx.objectStore(STORE_DAILY);

  // 1) Inserta eventos.
  for (const e of events) {
    eventStore.add(e);
  }

  // 2) Aplica deltas diarios.
  const now = Date.now();
  for (const [day, delta] of dailyDeltas.entries()) {
    const current = (await req<DailyStats | undefined>(dailyStore.get(day))) || defaultDaily(day, now);

    current.attempts += delta.attempts || 0;
    current.time += delta.time || 0;
    current.blockedTime += delta.blockedTime || 0;
    current.sessions += delta.sessions || 0;

    if (delta.timeByDomain) {
      for (const [domain, sec] of Object.entries(delta.timeByDomain)) {
        current.timeByDomain[domain] = (current.timeByDomain[domain] || 0) + sec;
      }
    }

    current.updatedAt = delta.updatedAt || now;
    dailyStore.put(current);
  }

  await txDone(tx);
}

export async function clearDb() {
  const db = await openDb();
  const tx = db.transaction([STORE_EVENTS, STORE_DAILY], "readwrite");
  tx.objectStore(STORE_EVENTS).clear();
  tx.objectStore(STORE_DAILY).clear();
  await txDone(tx);
}
