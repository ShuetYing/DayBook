import { describe, expect, it } from 'vitest';
import { formatWeekRange, glossaryTitle, groupGlossary, listTaskMonths, listWeeklyLogMonths, localDataSummary, msUntilNextBackup, parseProjectTimeline, questionPreview, searchData, serializeProjectTimeline, taskMonth, weeklyLogTitle } from './App';
import type { DayBookData, Task, WeeklyLog } from './types';

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

function makeWeeklyLog(overrides: Partial<WeeklyLog>): WeeklyLog {
  return {
    id: 'log-1',
    weekStart: '2026-08-31',
    learned: '',
    workedOn: '',
    blockers: '',
    solved: '',
    impact: '',
    openQuestions: '',
    nextWeek: '',
    tags: [],
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T08:00:00.000Z',
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

describe('local data summary', () => {
  it('only shows stored record types', () => {
    expect(localDataSummary(data)).toBe('1 task, 1 glossary term');
  });

  it('returns blank when no local records are stored', () => {
    expect(localDataSummary({ ...data, tasks: [], glossary: [] })).toBe('');
  });
});

describe('week range label', () => {
  it('keeps the dashboard week label compact', () => {
    expect(formatWeekRange(new Date(2026, 7, 31), new Date(2026, 8, 6))).toBe('31 Aug - 6 Sept 2026');
  });

  it('shows saved weekly logs as a work-week range', () => {
    expect(weeklyLogTitle(makeWeeklyLog({ weekStart: '2026-08-31' }))).toBe('Week of 2026-08-31 to 2026-09-04');
  });

  it('lists weekly log months newest first', () => {
    expect(listWeeklyLogMonths([
      makeWeeklyLog({ id: 'a', weekStart: '2026-07-06' }),
      makeWeeklyLog({ id: 'b', weekStart: '2026-09-07' }),
      makeWeeklyLog({ id: 'c', weekStart: '2026-07-13' })
    ])).toEqual(['2026-09', '2026-07']);
  });
});

describe('glossary title', () => {
  it('shows term and meaning together', () => {
    expect(glossaryTitle({ ...data.glossary[0], term: 'DMC', meaning: 'Device ID' })).toBe('DMC : Device ID');
  });

  it('groups terms alphabetically', () => {
    const groups = groupGlossary([
      { ...data.glossary[0], id: 'yield', term: 'Yield' },
      { ...data.glossary[0], id: 'dmc', term: 'DMC', meaning: 'Device ID' },
      { ...data.glossary[0], id: '8d', term: '8D' }
    ]);

    expect(groups.map(([letter, entries]) => [letter, entries.map((entry) => entry.term)])).toEqual([
      ['#', ['8D']],
      ['D', ['DMC']],
      ['Y', ['Yield']]
    ]);
  });
});

describe('question preview', () => {
  it('shows the answer when one exists', () => {
    expect(questionPreview({ id: 'q1', question: 'What is DMC?', status: 'Answered', relatedSystem: '', relatedKnowledge: '', notes: 'Device ID', createdAt: '', updatedAt: '' })).toBe('Device ID');
  });

  it('shows an empty-state answer', () => {
    expect(questionPreview({ id: 'q1', question: 'What is DMC?', status: 'Open', relatedSystem: '', relatedKnowledge: '', notes: '', createdAt: '', updatedAt: '' })).toBe('No answer yet');
  });
});
