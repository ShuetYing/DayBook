import type { DayBookData } from './types';

const DB_NAME = 'daybook';
const STORE = 'kv';
const DATA_KEY = 'data';
const EMPTY_DATA: DayBookData = {
  tasks: [],
  notes: [],
  projects: [],
  activities: [],
  weeklySummaries: [],
  settings: { theme: 'mint' }
};

export async function loadData(): Promise<DayBookData> {
  const data = await read<Partial<DayBookData>>(DATA_KEY);
  return {
    tasks: data?.tasks ?? [],
    notes: data?.notes ?? [],
    projects: data?.projects ?? [],
    activities: data?.activities ?? [],
    weeklySummaries: data?.weeklySummaries ?? [],
    settings: data?.settings ?? EMPTY_DATA.settings
  };
}

export async function saveData(data: DayBookData): Promise<void> {
  await write(DATA_KEY, data);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function read<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function write<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
