import type { DayBookData } from './types';

export function backupBlob(data: DayBookData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}
