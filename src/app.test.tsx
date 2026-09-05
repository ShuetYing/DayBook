import { describe, expect, it } from 'vitest';
import { listTaskMonths, msUntilNextBackup, parseProjectTimeline, searchData, serializeProjectTimeline, taskMonth } from './App';
import type { DayBookData, Task } from './types';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Task',
    notes: '',
    status: 'done',
    dueAt: '',
    reminderAt: '',
    roadblock: '',
    category: '',
    tags: [],
    projectId: '',
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z',
    ...overrides
  };
}

describe('completed task month helpers', () => {
  it('uses updatedAt as the completed month', () => {
    expect(taskMonth(makeTask({ updatedAt: '2026-08-14T12:30:00.000Z' }))).toBe('2026-08');
  });

  it('lists unique months newest first', () => {
    const months = listTaskMonths([
      makeTask({ id: 'a', updatedAt: '2026-07-10T09:00:00.000Z' }),
      makeTask({ id: 'b', updatedAt: '2026-09-03T09:00:00.000Z' }),
      makeTask({ id: 'c', updatedAt: '2026-07-18T09:00:00.000Z' }),
      makeTask({ id: 'd', updatedAt: '2026-08-01T09:00:00.000Z' })
    ]);

    expect(months).toEqual(['2026-09', '2026-08', '2026-07']);
  });
});

describe('project timeline helpers', () => {
  it('parses stage, date and detail rows', () => {
    expect(parseProjectTimeline('Stage 1 | 2026-09-01 | Gather requirements')).toEqual([
      { name: 'Stage 1', due: '2026-09-01', detail: 'Gather requirements' }
    ]);
  });

  it('serializes stage fields into saved timeline text', () => {
    expect(serializeProjectTimeline([
      { name: 'Stage 1', due: '2026-09-01', detail: 'Gather requirements' },
      { name: '', due: '', detail: '' },
      { name: 'Stage 2', due: '2026-09-05', detail: 'Share update' }
    ])).toBe('Stage 1 | 2026-09-01 | Gather requirements\nStage 2 | 2026-09-05 | Share update');
  });
});

describe('global search', () => {
  const data: DayBookData = {
    tasks: [makeTask({ title: 'Review supplier pipeline', notes: 'Check blocked warehouse handoff', tags: ['pipeline'] })],
    notes: [],
    projects: [],
    activities: [],
    weeklyLogs: [],
    systems: [],
    troubleshooting: [],
    questions: [],
    captures: [],
    glossary: [{
      id: 'term-1',
      term: 'SPC',
      meaning: 'Statistical process control',
      context: 'Quality chart',
      createdAt: '2026-09-03T08:00:00.000Z',
      updatedAt: '2026-09-03T08:00:00.000Z'
    }],
    settings: { theme: 'mint', density: 'comfortable' }
  };

  it('includes matching tasks', () => {
    expect(searchData(data, 'warehouse')).toEqual([
      { type: 'Task', id: 'task-1', title: 'Review supplier pipeline', detail: 'Check blocked warehouse handoff', tags: ['pipeline'] }
    ]);
  });

  it('includes matching glossary terms', () => {
    expect(searchData(data, 'statistical').map((result) => result.type)).toEqual(['Glossary']);
  });
});

describe('daily backup schedule', () => {
  it('targets the next local midnight', () => {
    expect(msUntilNextBackup(new Date(2026, 8, 5, 23, 59, 0))).toBe(60_000);
    expect(msUntilNextBackup(new Date(2026, 8, 5, 0, 0, 0))).toBe(86_400_000);
  });
});
