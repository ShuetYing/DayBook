import { describe, expect, it } from 'vitest';
import { backupBlob } from './backup';
import type { DayBookData } from './types';

describe('backupBlob', () => {
  it('serializes the full local data object as JSON', async () => {
    const data: DayBookData = {
      tasks: [],
      notes: [],
      projects: [],
      activities: [],
      weeklyLogs: [],
      systems: [],
      troubleshooting: [],
      questions: [],
      captures: [{ id: 'capture-1', text: 'remember this', tags: ['work'], createdAt: '2026-08-30T09:00:00.000Z', updatedAt: '2026-08-30T09:00:00.000Z' }],
      glossary: [],
      scratchpadItems: [],
      settings: { theme: 'mint', density: 'comfortable' }
    };

    expect(JSON.parse(await backupBlob(data).text()).captures[0].text).toBe('remember this');
  });
});
