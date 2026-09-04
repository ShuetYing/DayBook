import { describe, expect, it } from 'vitest';
import { listTaskMonths, taskMonth } from './App';
import type { Task } from './types';

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
