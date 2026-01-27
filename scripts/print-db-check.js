const snippets = [
  {
    title: "IndexedDB counts (events + daily_stats)",
    code: `(() => {
  const openDb = (name) =>
    new Promise((res, rej) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

  const countStore = (store) =>
    new Promise((res, rej) => {
      const req = store.count();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

  (async () => {
    const db = await openDb("focus-tube-blocker");
    const tx = db.transaction(["events", "daily_stats"], "readonly");
    const events = await countStore(tx.objectStore("events"));
    const daily = await countStore(tx.objectStore("daily_stats"));
    console.log({ events, daily });
  })();
})();`
  },
  {
    title: "SQLite file size (sqlite_file/main)",
    code: `(() => {
  const openDb = (name) =>
    new Promise((res, rej) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

  const getRow = (store, key) =>
    new Promise((res, rej) => {
      const req = store.get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

  (async () => {
    const db = await openDb("focus-tube-blocker-sqlite");
    const tx = db.transaction("sqlite_file", "readonly");
    const row = await getRow(tx.objectStore("sqlite_file"), "main");
    console.log("sqlite_file bytes:", row?.data?.byteLength || 0);
  })();
})();`
  }
];

console.log("Run these snippets in the extension Service Worker DevTools console.");
console.log("Open: chrome://extensions -> your extension -> Service worker -> Inspect");
for (const snippet of snippets) {
  console.log(`\n// ${snippet.title}\n${snippet.code}\n`);
}
