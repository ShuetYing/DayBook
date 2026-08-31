import type { DayBookData, WeeklyLog } from './types';

export function parseTags(value: string): string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))];
}

export function formatDateInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getWeekBounds(today = new Date()): { start: Date; end: Date } {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function emptyWeeklyLog(weekStart: string, now: string): WeeklyLog {
  return {
    id: weekStart,
    weekStart,
    learned: '',
    workedOn: '',
    blockers: '',
    solved: '',
    impact: '',
    openQuestions: '',
    nextWeek: '',
    tags: [],
    createdAt: now,
    updatedAt: now
  };
}

export function generateWeeklyReviewDraft(data: DayBookData, selectedDate = new Date(), now = new Date().toISOString()): WeeklyLog {
  const { start, end } = getWeekBounds(selectedDate);
  const weekStart = formatDateInput(start);
  const inWeek = (value: string) => {
    const date = new Date(value);
    return date >= start && date <= end;
  };
  const titles = (items: { title?: string; name?: string; question?: string; text?: string }[]) =>
    items.map((item) => item.title || item.name || item.question || item.text || '').filter(Boolean).join('\n');

  const notes = data.notes.filter((note) => inWeek(note.createdAt));
  const solved = data.troubleshooting.filter((entry) => entry.dateResolved && inWeek(`${entry.dateResolved}T12:00:00`));
  const answered = data.questions.filter((question) => question.status === 'Answered' && inWeek(question.updatedAt));
  const systems = data.systems.filter((system) => inWeek(system.updatedAt));
  const captures = data.captures.filter((capture) => inWeek(capture.createdAt));
  const doneTasks = data.tasks.filter((task) => task.status === 'done' && inWeek(task.updatedAt));
  const openQuestions = data.questions.filter((question) => question.status !== 'Answered');

  return {
    ...emptyWeeklyLog(weekStart, now),
    learned: titles(notes),
    workedOn: titles([...doneTasks, ...systems, ...captures]),
    blockers: titles(data.tasks.filter((task) => task.roadblock && task.status !== 'done')),
    solved: titles(solved),
    impact: doneTasks.map((task) => task.title).join('\n'),
    openQuestions: titles(openQuestions),
    nextWeek: titles([...openQuestions, ...answered]).split('\n').slice(0, 5).join('\n'),
    tags: ['weekly-review']
  };
}

export function weeklyLogReminderWeek(weeklyLogs: WeeklyLog[], now = new Date(), remindedWeeks = new Set<string>()): string {
  const weekStart = formatDateInput(getWeekBounds(now).start);
  if (now.getDay() !== 5 || now.getHours() < 15) return '';
  if (weeklyLogs.some((log) => log.weekStart === weekStart) || remindedWeeks.has(weekStart)) return '';
  return weekStart;
}
