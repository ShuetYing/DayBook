import type { Note, Task, WeeklySummary } from './types';

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

export function buildWeeklySummary(tasks: Task[], notes: Note[], today = new Date()): WeeklySummary {
  const { start, end } = getWeekBounds(today);
  const weekTasks = tasks.filter((task) => isWithin(task.updatedAt || task.createdAt, start, end));
  const completedTasks = weekTasks.filter((task) => task.status === 'done');
  const completed = completedTasks.length;
  const incomplete = tasks.filter((task) => task.status !== 'done').length;
  const inProgressTasks = tasks.filter((task) => task.status === 'in-progress');
  const inProgress = inProgressTasks.length;
  const carriedForwardTasks = tasks.filter((task) => task.status !== 'done' && task.dueAt && new Date(task.dueAt) < start);
  const carriedForward = carriedForwardTasks.length;
  const noteHighlights = notes
    .filter((note) => isWithin(note.updatedAt || note.createdAt, start, end))
    .slice(0, 5)
    .map((note) => note.title || note.body.slice(0, 60));

  const completedLine = completedTasks.length
    ? `Completed: ${completedTasks.slice(0, 4).map((task) => task.title).join('; ')}.`
    : 'Completed: none recorded this week.';
  const inProgressLine = inProgressTasks.length
    ? `In progress: ${inProgressTasks.slice(0, 4).map((task) => task.title).join('; ')}.`
    : 'In progress: none.';
  const carriedLine = carriedForwardTasks.length
    ? `Carried over: ${carriedForwardTasks.slice(0, 4).map((task) => task.title).join('; ')}.`
    : 'Carried over: none.';
  const learningLine = noteHighlights.length
    ? `Learning: ${noteHighlights.join('; ')}.`
    : 'Learning: none recorded this week.';
  const generatedText = [completedLine, inProgressLine, carriedLine, learningLine].join(' ');

  return {
    id: `${formatDateInput(start)}-${formatDateInput(end)}`,
    weekStart: formatDateInput(start),
    weekEnd: formatDateInput(end),
    generatedText,
    taskStats: { completed, incomplete, inProgress, carriedForward },
    noteHighlights,
    createdAt: new Date().toISOString()
  };
}

function isWithin(value: string, start: Date, end: Date): boolean {
  const date = new Date(value);
  return date >= start && date <= end;
}
