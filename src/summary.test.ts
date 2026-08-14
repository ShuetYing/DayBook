import { describe, expect, it } from 'vitest';
import { buildWeeklySummary, parseTags } from './summary';
import type { Note, Task } from './types';

const baseTask: Task = {
  id: 'task-1',
  title: 'Review DAG',
  notes: '',
  status: 'todo',
  dueAt: '',
  reminderAt: '',
  roadblock: '',
  category: 'Work',
  tags: [],
  projectId: '',
  createdAt: '2026-08-10T10:00:00.000Z',
  updatedAt: '2026-08-10T10:00:00.000Z'
};

const baseNote: Note = {
  id: 'note-1',
  title: 'Partition pruning',
  body: 'Use partition filters before joining large tables.',
  category: 'Learning',
  tags: ['sql'],
  createdAt: '2026-08-11T10:00:00.000Z',
  updatedAt: '2026-08-11T10:00:00.000Z'
};

describe('weekly summary', () => {
  it('counts completed, incomplete, and carried-forward tasks', () => {
    const summary = buildWeeklySummary([
      { ...baseTask, status: 'done' },
      { ...baseTask, id: 'task-2', title: 'Fix model', dueAt: '2026-08-12T08:00:00.000Z' },
      { ...baseTask, id: 'task-3', title: 'Old blocker', dueAt: '2026-08-03T08:00:00.000Z' }
    ], [baseNote], new Date('2026-08-12T12:00:00.000Z'));

    expect(summary.weekStart).toBe('2026-08-10');
    expect(summary.weekEnd).toBe('2026-08-16');
    expect(summary.taskStats).toEqual({ completed: 1, incomplete: 2, inProgress: 0, carriedForward: 1 });
    expect(summary.noteHighlights).toEqual(['Partition pruning']);
    expect(summary.generatedText).toContain('Completed: Review DAG.');
    expect(summary.generatedText).toContain('Carried over: Old blocker.');
    expect(summary.generatedText).toContain('Learning: Partition pruning.');
  });
});

describe('parseTags', () => {
  it('trims blanks and removes duplicates', () => {
    expect(parseTags('sql, airflow, sql, , warehouse')).toEqual(['sql', 'airflow', 'warehouse']);
  });
});
