import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { DailyDelta, DailyStats, DbEvent } from "./dbTypes";

const FILE_DB_NAME = "focus-tube-blocker-sqlite";
const FILE_DB_VERSION = 1;
const FILE_STORE = "sqlite_file";
const FILE_KEY = "main";

type SqliteContext = {
  db: Database;
  SQL: SqlJsStatic;
};

let sqlitePromise: Promise<SqliteContext> | null = null;
let fileDbPromise: Promise<IDBDatabase> | null = null;

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

async function openFileDb(): Promise<IDBDatabase> {
  if (fileDbPromise) {
    return fileDbPromise;
  }

  fileDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB_NAME, FILE_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open error"));
  });

  return fileDbPromise;
}

async function loadSqliteFile(): Promise<ArrayBuffer | null> {
  const db = await openFileDb();
  const tx = db.transaction(FILE_STORE, "readonly");
  const store = tx.objectStore(FILE_STORE);
  const result = await req<{ key: string; data: ArrayBuffer } | undefined>(store.get(FILE_KEY));
  await txDone(tx);
  return result?.data || null;
}

async function saveSqliteFile(data: Uint8Array): Promise<void> {
  const db = await openFileDb();
  const tx = db.transaction(FILE_STORE, "readwrite");
  const store = tx.objectStore(FILE_STORE);
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  store.put({ key: FILE_KEY, data: buffer });
  await txDone(tx);
}

function initSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      day TEXT NOT NULL,
      type TEXT NOT NULL,
      domain TEXT,
      url TEXT,
      deltaSec INTEGER,
      tabId INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_events_day ON events(day);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_domain ON events(domain);

    CREATE TABLE IF NOT EXISTS daily_stats (
      day TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL,
      time INTEGER NOT NULL,
      blockedTime INTEGER NOT NULL,
      sessions INTEGER NOT NULL,
      timeByDomain TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
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

async function persistSqlite(db: Database) {
  const data = db.export();
  await saveSqliteFile(data);
}

export async function ensureSqliteReady() {
  if (sqlitePromise) {
    await sqlitePromise;
    return;
  }

  sqlitePromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => {
        if (typeof chrome !== "undefined" && chrome.runtime?.getURL && !wasmUrl.startsWith("chrome-extension://")) {
          return chrome.runtime.getURL(wasmUrl);
        }
        return wasmUrl;
      }
    });
    const saved = await loadSqliteFile();
    const db = saved ? new SQL.Database(new Uint8Array(saved)) : new SQL.Database();
    initSchema(db);
    return { db, SQL };
  })();

  await sqlitePromise;
}

function parseTimeByDomain(input: string | null | undefined): Record<string, number> {
  if (!input) {
    return {};
  }
  try {
    const parsed = JSON.parse(input) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function getDb(): Promise<Database> {
  await ensureSqliteReady();
  const ctx = await sqlitePromise;
  if (!ctx) {
    throw new Error("SQLite not initialized");
  }
  return ctx.db;
}

export async function flushToSqlite(events: Omit<DbEvent, "id">[], dailyDeltas: Map<string, DailyDelta>) {
  if (events.length === 0 && dailyDeltas.size === 0) {
    return;
  }

  const db = await getDb();
  db.exec("BEGIN;");

  const insertEvent = db.prepare(
    "INSERT INTO events (ts, day, type, domain, url, deltaSec, tabId) VALUES (?, ?, ?, ?, ?, ?, ?);"
  );
  for (const e of events) {
    insertEvent.run([
      e.ts,
      e.day,
      e.type,
      e.domain ?? null,
      e.url ?? null,
      e.deltaSec ?? null,
      e.tabId ?? null
    ]);
  }
  insertEvent.free();

  const selectDaily = db.prepare(
    "SELECT day, attempts, time, blockedTime, sessions, timeByDomain, updatedAt FROM daily_stats WHERE day = ?;"
  );
  const upsertDaily = db.prepare(
    `INSERT INTO daily_stats (day, attempts, time, blockedTime, sessions, timeByDomain, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       attempts = excluded.attempts,
       time = excluded.time,
       blockedTime = excluded.blockedTime,
       sessions = excluded.sessions,
       timeByDomain = excluded.timeByDomain,
       updatedAt = excluded.updatedAt;`
  );

  const now = Date.now();
  for (const [day, delta] of dailyDeltas.entries()) {
    selectDaily.bind([day]);
    const row = selectDaily.step()
      ? {
          day: selectDaily.getAsObject().day as string,
          attempts: Number(selectDaily.getAsObject().attempts || 0),
          time: Number(selectDaily.getAsObject().time || 0),
          blockedTime: Number(selectDaily.getAsObject().blockedTime || 0),
          sessions: Number(selectDaily.getAsObject().sessions || 0),
          timeByDomain: String(selectDaily.getAsObject().timeByDomain || ""),
          updatedAt: Number(selectDaily.getAsObject().updatedAt || 0)
        }
      : null;
    selectDaily.reset();

    const current = row
      ? {
          day: row.day,
          attempts: row.attempts,
          time: row.time,
          blockedTime: row.blockedTime,
          sessions: row.sessions,
          timeByDomain: parseTimeByDomain(row.timeByDomain),
          updatedAt: row.updatedAt
        }
      : defaultDaily(day, now);

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
    upsertDaily.run([
      current.day,
      current.attempts,
      current.time,
      current.blockedTime,
      current.sessions,
      JSON.stringify(current.timeByDomain),
      current.updatedAt
    ]);
  }
  selectDaily.free();
  upsertDaily.free();

  db.exec("COMMIT;");
  await persistSqlite(db);
}

export async function clearSqlite() {
  const db = await getDb();
  db.exec("DELETE FROM events;");
  db.exec("DELETE FROM daily_stats;");
  await persistSqlite(db);
}
