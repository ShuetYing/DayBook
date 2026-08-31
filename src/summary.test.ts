import { describe, expect, it } from 'vitest';
import { generateWeeklyReviewDraft, parseTags, weeklyLogReminderWeek } from './summary';
import type { DayBookData, WeeklyLog } from './types';

const emptyData: DayBookData = {
  tasks: [],
  notes: [],
  projects: [],
  activities: [],
  weeklyLogs: [],
  systems: [],
  troubleshooting: [],
  questions: [],
  captures: [],
  settings: { theme: 'mint' }
};

describe('weekly review draft', () => {
  it('builds a local editable draft from records in the selected week', () => {
    const draft = generateWeeklyReviewDraft({
      ...emptyData,
      notes: [{
        id: 'note-1',
        title: 'Pipeline trigger mechanism',
        body: '',
        category: '',
        tags: ['pipeline'],
        createdAt: '2026-08-25T09:00:00.000Z',
        updatedAt: '2026-08-25T09:00:00.000Z'
      }],
      troubleshooting: [{
        id: 'fix-1',
        title: 'Missing metadata broke pipeline',
        symptoms: '',
        error: '',
        hypothesis: '',
        investigation: '',
        rootCause: '',
        solution: '',
        prevention: '',
        relatedSystem: 'Pipeline X',
        tags: ['debugging'],
        dateResolved: '2026-08-26',
        createdAt: '2026-08-26T09:00:00.000Z',
        updatedAt: '2026-08-26T09:00:00.000Z'
      }],
      questions: [{
        id: 'question-1',
        question: 'Who owns the metadata table?',
        status: 'Open',
        relatedSystem: 'Pipeline X',
        relatedKnowledge: '',
        notes: '',
        createdAt: '2026-08-26T09:00:00.000Z',
        updatedAt: '2026-08-26T09:00:00.000Z'
      }]
    }, new Date('2026-08-27T12:00:00.000Z'));

    expect(draft.weekStart).toBe('2026-08-24');
    expect(draft.learned).toContain('Pipeline trigger mechanism');
    expect(draft.solved).toContain('Missing metadata broke pipeline');
    expect(draft.openQuestions).toContain('Who owns the metadata table?');
  });
});

describe('weekly log reminder', () => {
  const savedLog: WeeklyLog = {
    id: '2026-08-24',
    weekStart: '2026-08-24',
    learned: '',
    workedOn: '',
    blockers: '',
    solved: '',
    impact: '',
    openQuestions: '',
    nextWeek: '',
    tags: [],
    createdAt: '2026-08-29T01:00:00.000Z',
    updatedAt: '2026-08-29T01:00:00.000Z'
  };

  it('reminds after Friday 3pm only when the week has no log', () => {
    expect(weeklyLogReminderWeek([], new Date('2026-08-28T14:59:00'))).toBe('');
    expect(weeklyLogReminderWeek([], new Date('2026-08-28T15:00:00'))).toBe('2026-08-24');
    expect(weeklyLogReminderWeek([savedLog], new Date('2026-08-28T15:00:00'))).toBe('');
    expect(weeklyLogReminderWeek([], new Date('2026-08-28T15:00:00'), new Set(['2026-08-24']))).toBe('');
  });
});

describe('parseTags', () => {
  it('trims blanks and removes duplicates', () => {
    expect(parseTags('sql, pipeline, sql, , debugging')).toEqual(['sql', 'pipeline', 'debugging']);
  });
});
