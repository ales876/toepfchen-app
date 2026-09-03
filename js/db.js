// Persistenz: IndexedDB. Alles bleibt auf dem Geraet, kein Netzwerkzugriff.
// Warum IndexedDB und nicht localStorage: strukturierte Objekte, Index auf ts,
// keine 5-MB-Wand, und async passt zum Service-Worker-Betrieb.

const DB_NAME = 'potty-quest';
const DB_VERSION = 1;
const STORE_EVENTS = 'events';
const STORE_META = 'meta';

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const store = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
        store.createIndex('ts', 'ts');
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const result = fn(t.objectStore(store));
        t.oncomplete = () => resolve(result && result.value !== undefined ? result.value : result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

export function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `e${Date.now()}${Math.random().toString(16).slice(2)}`;
}

export async function putEvent(ev) {
  const record = { ...ev, id: ev.id || newId() };
  await tx(STORE_EVENTS, 'readwrite', (s) => s.put(record));
  return record;
}

export async function putEvents(list) {
  await tx(STORE_EVENTS, 'readwrite', (s) => {
    list.forEach((ev) => s.put({ ...ev, id: ev.id || newId() }));
  });
  return list.length;
}

export async function deleteEvent(id) {
  await tx(STORE_EVENTS, 'readwrite', (s) => s.delete(id));
}

export async function allEvents() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const out = [];
    const t = db.transaction(STORE_EVENTS, 'readonly');
    const req = t.objectStore(STORE_EVENTS).index('ts').openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) {
        out.push(cur.value);
        cur.continue();
      } else resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearEvents() {
  await tx(STORE_EVENTS, 'readwrite', (s) => s.clear());
}

export async function getMeta(key, fallback = null) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_META, 'readonly').objectStore(STORE_META).get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
    req.onerror = () => reject(req.error);
  });
}

export async function setMeta(key, value) {
  await tx(STORE_META, 'readwrite', (s) => s.put({ key, value }));
  return value;
}
