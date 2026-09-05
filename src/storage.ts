import type { DayBookData, WeeklyLog } from './types';

const DB_NAME = 'daybook';
const STORE = 'kv';
const DATA_KEY = 'data';
const BACKUP_HANDLE_KEY = 'backup-file-handle';
const EMPTY_DATA: DayBookData = {
  tasks: [],
  notes: [],
  projects: [],
  activities: [],
  weeklyLogs: [],
  systems: [],
  troubleshooting: [],
  questions: [],
  captures: [],
  glossary: [],
  settings: { theme: 'mint', density: 'comfortable' }
};

export async function loadData(): Promise<DayBookData> {
  const data = await read<Partial<DayBookData> & { weeklySummaries?: LegacyWeeklySummary[] }>(DATA_KEY);
  return {
    tasks: data?.tasks ?? [],
    notes: data?.notes ?? [],
    projects: data?.projects ?? [],
    activities: data?.activities ?? [],
    weeklyLogs: data?.weeklyLogs ?? (data?.weeklySummaries ?? []).map(summaryToLog),
    systems: data?.systems ?? [],
    troubleshooting: data?.troubleshooting ?? [],
    questions: data?.questions ?? [],
    captures: data?.captures ?? [],
    glossary: data?.glossary ?? [],
    settings: { ...EMPTY_DATA.settings, ...data?.settings }
  };
}

export async function saveData(data: DayBookData): Promise<void> {
  await write(DATA_KEY, data);
}

export async function loadBackupHandle<T>(): Promise<T | undefined> {
  return read<T>(BACKUP_HANDLE_KEY);
}

export async function saveBackupHandle<T>(handle: T): Promise<void> {
  await write(BACKUP_HANDLE_KEY, handle);
}

type LegacyWeeklySummary = {
  id: string;
  weekStart: string;
  generatedText: string;
  noteHighlights?: string[];
  createdAt: string;
};

function summaryToLog(summary: LegacyWeeklySummary): WeeklyLog {
  return {
    id: summary.id,
    weekStart: summary.weekStart,
    learned: (summary.noteHighlights ?? []).join('\n'),
    workedOn: summary.generatedText,
    blockers: '',
    solved: '',
    impact: '',
    openQuestions: '',
    nextWeek: '',
    tags: [],
    createdAt: summary.createdAt,
    updatedAt: summary.createdAt
  };
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
