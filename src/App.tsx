import { Dispatch, FormEvent, ReactNode, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { backupBlob } from './backup';
import { emptyWeeklyLog, formatDateInput, getWeekBounds, parseTags, weeklyLogReminderWeek } from './summary';
import { loadBackupHandle, loadData, saveBackupHandle, saveData } from './storage';
import type {
  Activity,
  AppSettings,
  DayBookData,
  GlossaryEntry,
  Note,
  ScratchpadItem,
  Project,
  QuestionEntry,
  QuestionStatus,
  QuickCapture,
  SystemEntry,
  Task,
  TaskStatus,
  TroubleshootingEntry,
  WeeklyLog
} from './types';

type Page = 'dashboard' | 'tasks' | 'projects' | 'scratchpad' | 'knowledge' | 'glossary' | 'systems' | 'troubleshooting' | 'questions' | 'weekly' | 'search' | 'settings';
type ProjectTab = 'overview' | 'tasks' | 'timeline';
type PrefillTarget = 'knowledge' | 'troubleshooting' | 'questions';
type BackupFileHandle = {
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
  queryPermission?: (options?: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (options?: { mode: 'readwrite' }) => Promise<PermissionState>;
};

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
  glossary: [],
  scratchpadItems: [],
  settings: { theme: 'mint', density: 'comfortable' }
};
const standardNoteTemplate = '<Summary>\n\n___________________________________________________________________\n\n<Context>\n\n___________________________________________________________________\n\n<Details>\n\n___________________________________________________________________\n\n<Example / Command>\n';
const presetTags = ['pipeline', 'debugging', 'sql', 'python', 'database', 'cloud', 'manufacturing', 'process', 'system', 'troubleshooting'];
const navItems: { page: Page; label: string }[] = [
  { page: 'dashboard', label: 'Dashboard' },
  { page: 'tasks', label: 'Tasks' },
  { page: 'projects', label: 'Projects' },
  { page: 'scratchpad', label: 'Scratchpad' },
  { page: 'knowledge', label: 'Knowledge' },
  { page: 'glossary', label: 'Glossary' },
  { page: 'systems', label: 'Systems' },
  { page: 'troubleshooting', label: 'Troubleshooting' },
  { page: 'questions', label: 'Questions' },
  { page: 'weekly', label: 'Weekly Logs' },
  { page: 'search', label: 'Search' },
  { page: 'settings', label: 'Settings' }
];
const pageDescriptions: Record<Page, string> = {
  dashboard: 'Plan the week, capture work, and see what changed recently.',
  tasks: 'Track deadlines, blockers, reminders, and completed work.',
  projects: 'Keep project stages, linked tasks, and progress in one place.',
  scratchpad: 'A low-pressure place for random reminders, thoughts, mood, or feelings.',
  knowledge: 'Save reusable notes, commands, and lessons learned.',
  glossary: 'Build a practical vocabulary for manufacturing and data work.',
  systems: 'Document important workflows, pipelines, and tools.',
  troubleshooting: 'Turn errors and fixes into a searchable playbook.',
  questions: 'Hold open questions until they become answers.',
  weekly: 'Summarise learning, contribution, blockers, and next steps.',
  search: 'Search across your local DayBook records.',
  settings: 'Manage backups, appearance, reminders, import, and export.'
};

export default function App() {
  const [data, setData] = useState<DayBookData>(emptyData);
  const [undoData, setUndoData] = useState<DayBookData | null>(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [message, setMessage] = useState('');
  const [backupHandle, setBackupHandle] = useState<BackupFileHandle | null>(null);
  const [backupStatus, setBackupStatus] = useState('Auto backup is not set up.');
  const [query, setQuery] = useState('');
  const [weekDate, setWeekDate] = useState(formatDateInput(new Date()));
  const [weeklyDraft, setWeeklyDraft] = useState(emptyWeeklyLog(formatDateInput(getWeekBounds().start), new Date().toISOString()));
  const [prefill, setPrefill] = useState<Partial<Record<PrefillTarget, string>>>({});
  const [projectTabs, setProjectTabs] = useState<Record<string, ProjectTab>>({});
  const [expandedActivity, setExpandedActivity] = useState(false);
  const [expandedDashboardTasks, setExpandedDashboardTasks] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState('');
  const [editingSelectedKnowledge, setEditingSelectedKnowledge] = useState(false);
  const notified = useRef(new Set<string>());
  const notifiedWeeklyLogs = useRef(new Set<string>());
  const messageTimer = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([loadData(), loadBackupHandle<BackupFileHandle>()]).then(([savedData, savedHandle]) => {
      setData(savedData);
      if (savedHandle) {
        setBackupHandle(savedHandle);
        setBackupStatus('Auto backup file selected.');
      }
    }).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) saveData(data);
  }, [data, ready]);

  useEffect(() => {
    if (!ready || !backupHandle) return;
    const timer = window.setTimeout(() => writeBackup(backupHandle, data, setBackupStatus), 600);
    return () => window.clearTimeout(timer);
  }, [backupHandle, data, ready]);

  useEffect(() => {
    if (!ready || !backupHandle) return;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        void writeBackup(backupHandle, data, setBackupStatus);
        schedule();
      }, msUntilNextBackup());
    };
    schedule();
    return () => {
      window.clearTimeout(timer);
    };
  }, [backupHandle, data, ready]);

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);

  useEffect(() => {
    document.documentElement.dataset.density = data.settings.density;
  }, [data.settings.density]);

  useEffect(() => {
    const timer = window.setInterval(() => notifyDueTasks(data.tasks, notified.current, flashMessage), 60_000);
    notifyDueTasks(data.tasks, notified.current, flashMessage);
    return () => window.clearInterval(timer);
  }, [data.tasks]);

  useEffect(() => {
    const check = () => notifyMissingWeeklyLog(data.weeklyLogs, notifiedWeeklyLogs.current, flashMessage);
    const timer = window.setInterval(check, 60_000);
    check();
    return () => window.clearInterval(timer);
  }, [data.weeklyLogs]);

  useEffect(() => () => {
    if (messageTimer.current != null) window.clearTimeout(messageTimer.current);
  }, []);

  useEffect(() => {
    const weekStart = formatDateInput(getWeekBounds(new Date(`${weekDate}T12:00:00`)).start);
    setWeeklyDraft(data.weeklyLogs.find((log) => log.weekStart === weekStart) ?? emptyWeeklyLog(weekStart, new Date().toISOString()));
  }, [data.weeklyLogs, weekDate]);

  const today = formatDateInput(new Date());
  const todayDate = new Date();
  const todayLabel = todayDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const currentPage = navItems.find((item) => item.page === page);
  const projectsById = new Map(data.projects.map((project) => [project.id, project]));

  function updateData(change: (current: DayBookData, now: string) => DayBookData) {
    const now = new Date().toISOString();
    setData((current) => {
      setUndoData(current);
      return change(current, now);
    });
  }

  function undoLastChange() {
    if (!undoData) return;
    setData(undoData);
    setUndoData(null);
    flashMessage('Last change undone.');
  }

  function flashMessage(text: string) {
    setMessage(text);
    if (messageTimer.current != null) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(''), 1800);
  }

  function withActivity(current: DayBookData, message: string, now: string): Activity[] {
    return [{ id: crypto.randomUUID(), message, createdAt: now }, ...current.activities].slice(0, 30);
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    if (!title) return;

    updateData((current, now) => ({
      ...current,
      tasks: [{
        id: crypto.randomUUID(),
        title,
        notes: String(form.get('notes') || '').trim(),
        status: String(form.get('status') || 'todo') as TaskStatus,
        dueAt: String(form.get('dueAt') || ''),
        reminderAt: String(form.get('reminderAt') || ''),
        roadblock: String(form.get('roadblock') || '').trim(),
        category: '',
        tags: parseTags(String(form.get('tags') || '')),
        projectId: String(form.get('projectId') || ''),
        createdAt: now,
        updatedAt: now
      }, ...current.tasks],
      activities: withActivity(current, `Created task: ${title}`, now)
    }));
    flashMessage(`Task created: ${title}`);
    event.currentTarget.reset();
  }

  function updateTask(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    if (!title) return;

    updateData((current, now) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === id ? {
        ...task,
        title,
        notes: String(form.get('notes') || '').trim(),
        status: String(form.get('status') || 'todo') as TaskStatus,
        dueAt: String(form.get('dueAt') || ''),
        reminderAt: String(form.get('reminderAt') || ''),
        roadblock: String(form.get('roadblock') || '').trim(),
        tags: parseTags(String(form.get('tags') || '')),
        projectId: String(form.get('projectId') || ''),
        updatedAt: now
      } : task),
      activities: withActivity(current, `Updated task: ${title}`, now)
    }));
    flashMessage(`Task updated: ${title}`);
    setExpandedTasks((current) => ({ ...current, [id]: false }));
  }

  function toggleTask(task: Task) {
    const status: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    updateData((current, now) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === task.id ? { ...item, status, updatedAt: now } : item),
      activities: withActivity(current, `${status === 'done' ? 'Completed' : 'Reopened'} task: ${task.title}`, now)
    }));
  }

  function deleteTask(task: Task) {
    updateData((current, now) => ({
      ...current,
      tasks: current.tasks.filter((item) => item.id !== task.id),
      activities: withActivity(current, `Deleted task: ${task.title}`, now)
    }));
    flashMessage(`Task deleted: ${task.title}`);
  }

  function addProjectTask(event: FormEvent<HTMLFormElement>, project: Project, stageName = '') {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    if (!title) return;

    updateData((current, now) => ({
      ...current,
      tasks: [{
        id: crypto.randomUUID(),
        title,
        notes: stageName ? `Stage: ${stageName}` : '',
        status: 'todo',
        dueAt: String(form.get('dueAt') || ''),
        reminderAt: '',
        roadblock: '',
        category: '',
        tags: [],
        projectId: project.id,
        createdAt: now,
        updatedAt: now
      }, ...current.tasks],
      activities: withActivity(current, `Added project task: ${title}`, now)
    }));
    flashMessage(`Task linked to ${project.name}: ${title}`);
    event.currentTarget.reset();
  }

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    if (!name) return;

    updateData((current, now) => ({
      ...current,
      projects: [{
        id: crypto.randomUUID(),
        name,
        overview: String(form.get('overview') || '').trim(),
        details: String(form.get('details') || '').trim(),
        progress: '',
        timeline: String(form.get('timeline') || '').trim(),
        category: '',
        tags: [],
        createdAt: now,
        updatedAt: now
      }, ...current.projects],
      activities: withActivity(current, `Created project: ${name}`, now)
    }));
    flashMessage(`Project created: ${name}`);
    event.currentTarget.reset();
  }

  function updateProject(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    if (!name) return;

    updateData((current, now) => ({
      ...current,
      projects: current.projects.map((project) => project.id === id ? {
        ...project,
        name,
        overview: String(form.get('overview') || '').trim(),
        details: String(form.get('details') || '').trim(),
        timeline: String(form.get('timeline') || '').trim(),
        tags: [],
        updatedAt: now
      } : project),
      activities: withActivity(current, `Updated project: ${name}`, now)
    }));
    flashMessage(`Project updated: ${name}`);
  }

  function deleteProject(project: Project) {
    updateData((current, now) => ({
      ...current,
      projects: current.projects.filter((item) => item.id !== project.id),
      tasks: current.tasks.map((task) => task.projectId === project.id ? { ...task, projectId: '', updatedAt: now } : task),
      activities: withActivity(current, `Deleted project: ${project.name}`, now)
    }));
    flashMessage(`Project deleted: ${project.name}`);
  }

  function addScratchpadItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    if (!title) return;
    updateData((current, now) => ({
      ...current,
      scratchpadItems: [{
        id: crypto.randomUUID(),
        title,
        context: '',
        notes: '',
        done: false,
        createdAt: now,
        updatedAt: now
      }, ...current.scratchpadItems],
      activities: withActivity(current, `Added scratchpad item: ${title}`, now)
    }));
    flashMessage('Scratchpad item saved.');
    event.currentTarget.reset();
  }

  function toggleScratchpadItem(item: ScratchpadItem) {
    updateData((current, now) => ({
      ...current,
      scratchpadItems: current.scratchpadItems.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done, updatedAt: now } : entry),
      activities: withActivity(current, `${item.done ? 'Reopened' : 'Completed'} scratchpad item: ${item.title}`, now)
    }));
  }

  function deleteScratchpadItem(item: ScratchpadItem) {
    updateData((current, now) => ({
      ...current,
      scratchpadItems: current.scratchpadItems.filter((entry) => entry.id !== item.id),
      activities: withActivity(current, `Deleted scratchpad item: ${item.title}`, now)
    }));
    flashMessage('Scratchpad item deleted.');
  }

  function updateScratchpadItem(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    if (!title) return;
    updateData((current, now) => ({
      ...current,
      scratchpadItems: current.scratchpadItems.map((item) => item.id === id ? { ...item, title, updatedAt: now } : item),
      activities: withActivity(current, `Updated scratchpad item: ${title}`, now)
    }));
    flashMessage('Scratchpad item updated.');
  }

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    const body = String(form.get('body') || '').trim();
    if (!title || !body) return;

    updateData((current, now) => ({
      ...current,
      notes: [{
        id: crypto.randomUUID(),
        title,
        body,
        category: '',
        tags: parseTags(String(form.get('tags') || '')),
        createdAt: now,
        updatedAt: now
      }, ...current.notes],
      activities: withActivity(current, `Created knowledge note: ${title}`, now)
    }));
    setPrefill((current) => ({ ...current, knowledge: '' }));
    flashMessage(`Knowledge note saved: ${title}`);
    event.currentTarget.reset();
  }

  function deleteNote(note: Note) {
    updateData((current, now) => ({
      ...current,
      notes: current.notes.filter((item) => item.id !== note.id),
      activities: withActivity(current, `Deleted knowledge note: ${note.title}`, now)
    }));
    flashMessage(`Knowledge note deleted: ${note.title}`);
  }

  function updateNote(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') || '').trim();
    const body = String(form.get('body') || '').trim();
    if (!title || !body) return;
    updateData((current, now) => ({
      ...current,
      notes: current.notes.map((note) => note.id === id ? { ...note, title, body, tags: parseTags(String(form.get('tags') || '')), updatedAt: now } : note),
      activities: withActivity(current, `Updated knowledge note: ${title}`, now)
    }));
    flashMessage(`Knowledge note updated: ${title}`);
  }

  function addGlossary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entry = glossaryFromForm(new FormData(event.currentTarget), new Date().toISOString());
    if (!entry.term || !entry.meaning) return;
    updateData((current, now) => ({
      ...current,
      glossary: [{ ...entry, id: crypto.randomUUID(), createdAt: now, updatedAt: now }, ...current.glossary],
      activities: withActivity(current, `Added glossary term: ${entry.term}`, now)
    }));
    flashMessage(`Glossary term saved: ${entry.term}`);
    event.currentTarget.reset();
  }

  function updateGlossary(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const entry = glossaryFromForm(new FormData(event.currentTarget), new Date().toISOString());
    if (!entry.term || !entry.meaning) return;
    updateData((current, now) => ({
      ...current,
      glossary: current.glossary.map((item) => item.id === id ? { ...item, ...entry, createdAt: item.createdAt, updatedAt: now } : item),
      activities: withActivity(current, `Updated glossary term: ${entry.term}`, now)
    }));
    flashMessage(`Glossary term updated: ${entry.term}`);
  }

  function deleteGlossary(entry: GlossaryEntry) {
    updateData((current, now) => ({
      ...current,
      glossary: current.glossary.filter((item) => item.id !== entry.id),
      activities: withActivity(current, `Deleted glossary term: ${entry.term}`, now)
    }));
    flashMessage(`Glossary term deleted: ${entry.term}`);
  }

  function saveWeeklyLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateData((current, now) => ({
      ...current,
      weeklyLogs: [{ ...weeklyDraft, updatedAt: now }, ...current.weeklyLogs.filter((log) => log.id !== weeklyDraft.id)],
      activities: withActivity(current, `Saved weekly log: ${weeklyDraft.weekStart}`, now)
    }));
    flashMessage(`Weekly log saved: ${weeklyDraft.weekStart}`);
  }

  function deleteWeeklyLog(log: WeeklyLog) {
    updateData((current, now) => ({
      ...current,
      weeklyLogs: current.weeklyLogs.filter((item) => item.id !== log.id),
      activities: withActivity(current, `Deleted weekly log: ${log.weekStart}`, now)
    }));
    flashMessage(`Weekly log deleted: ${log.weekStart}`);
  }

  function addSystem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entry = systemFromForm(new FormData(event.currentTarget), new Date().toISOString());
    if (!entry.name) return;
    updateData((current, now) => ({
      ...current,
      systems: [{ ...entry, id: crypto.randomUUID(), createdAt: now, updatedAt: now }, ...current.systems],
      activities: withActivity(current, `Created system: ${entry.name}`, now)
    }));
    flashMessage(`System saved: ${entry.name}`);
    event.currentTarget.reset();
  }

  function updateSystem(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const entry = systemFromForm(new FormData(event.currentTarget), new Date().toISOString());
    if (!entry.name) return;
    updateData((current, now) => ({
      ...current,
      systems: current.systems.map((system) => system.id === id ? { ...system, ...entry, createdAt: system.createdAt, updatedAt: now } : system),
      activities: withActivity(current, `Updated system: ${entry.name}`, now)
    }));
    flashMessage(`System updated: ${entry.name}`);
  }

  function deleteSystem(system: SystemEntry) {
    updateData((current, now) => ({
      ...current,
      systems: current.systems.filter((item) => item.id !== system.id),
      activities: withActivity(current, `Deleted system: ${system.name}`, now)
    }));
    flashMessage(`System deleted: ${system.name}`);
  }

  function addTroubleshooting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entry = troubleshootingFromForm(new FormData(event.currentTarget), new Date().toISOString());
    if (!entry.title) return;
    updateData((current, now) => ({
      ...current,
      troubleshooting: [{ ...entry, id: crypto.randomUUID(), createdAt: now, updatedAt: now }, ...current.troubleshooting],
      activities: withActivity(current, `Created troubleshooting entry: ${entry.title}`, now)
    }));
    setPrefill((current) => ({ ...current, troubleshooting: '' }));
    flashMessage(`Troubleshooting saved: ${entry.title}`);
    event.currentTarget.reset();
  }

  function updateTroubleshooting(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const entry = troubleshootingFromForm(new FormData(event.currentTarget), new Date().toISOString());
    if (!entry.title) return;
    updateData((current, now) => ({
      ...current,
      troubleshooting: current.troubleshooting.map((item) => item.id === id ? { ...item, ...entry, createdAt: item.createdAt, updatedAt: now } : item),
      activities: withActivity(current, `Updated troubleshooting entry: ${entry.title}`, now)
    }));
    flashMessage(`Troubleshooting updated: ${entry.title}`);
  }

  function deleteTroubleshooting(entry: TroubleshootingEntry) {
    updateData((current, now) => ({
      ...current,
      troubleshooting: current.troubleshooting.filter((item) => item.id !== entry.id),
      activities: withActivity(current, `Deleted troubleshooting entry: ${entry.title}`, now)
    }));
    flashMessage(`Troubleshooting deleted: ${entry.title}`);
  }

  function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const question = String(form.get('question') || '').trim();
    if (!question) return;
    updateData((current, now) => ({
      ...current,
      questions: [{
        id: crypto.randomUUID(),
        question,
        status: String(form.get('status') || 'Open') as QuestionStatus,
        relatedSystem: String(form.get('relatedSystem') || '').trim(),
        relatedKnowledge: '',
        notes: String(form.get('notes') || '').trim(),
        createdAt: now,
        updatedAt: now
      }, ...current.questions],
      activities: withActivity(current, `Created question: ${question}`, now)
    }));
    setPrefill((current) => ({ ...current, questions: '' }));
    flashMessage('Question saved.');
    event.currentTarget.reset();
  }

  function updateQuestion(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const question = String(form.get('question') || '').trim();
    if (!question) return;
    updateData((current, now) => ({
      ...current,
      questions: current.questions.map((item) => item.id === id ? {
        ...item,
        question,
        status: String(form.get('status') || 'Open') as QuestionStatus,
        relatedSystem: String(form.get('relatedSystem') || '').trim(),
        relatedKnowledge: '',
        notes: String(form.get('notes') || '').trim(),
        updatedAt: now
      } : item),
      activities: withActivity(current, `Updated question: ${question}`, now)
    }));
    flashMessage('Question updated.');
  }

  function deleteQuestion(question: QuestionEntry) {
    updateData((current, now) => ({
      ...current,
      questions: current.questions.filter((item) => item.id !== question.id),
      activities: withActivity(current, `Deleted question: ${question.question}`, now)
    }));
    flashMessage('Question deleted.');
  }

  function addCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get('text') || '').trim();
    if (!text) return;
    updateData((current, now) => ({
      ...current,
      captures: [{ id: crypto.randomUUID(), text, tags: parseTags(String(form.get('tags') || '')), createdAt: now, updatedAt: now }, ...current.captures],
      activities: withActivity(current, 'Added quick capture', now)
    }));
    flashMessage('Captured.');
    event.currentTarget.reset();
  }

  function deleteCapture(capture: QuickCapture) {
    updateData((current, now) => ({
      ...current,
      captures: current.captures.filter((item) => item.id !== capture.id),
      activities: withActivity(current, 'Deleted quick capture', now)
    }));
  }

  function convertCapture(capture: QuickCapture, target: PrefillTarget) {
    setPrefill((current) => ({ ...current, [target]: capture.text }));
    setPage(target);
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setMessage('This browser does not support notifications.');
      return;
    }
    const permission = await Notification.requestPermission();
    setMessage(permission === 'granted' ? 'Notifications enabled while DayBook is open.' : 'Notifications are off. Deadlines still show in the app.');
  }

  function exportJson() {
    const blob = backupBlob(data);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daybook-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function chooseBackupFile() {
    const picker = (window as typeof window & {
      showSaveFilePicker?: (options?: unknown) => Promise<BackupFileHandle>;
    }).showSaveFilePicker;
    if (!picker) {
      flashMessage('Auto backup needs a Chromium browser with file picker support.');
      setBackupStatus('Auto backup is not supported in this browser. Use Export JSON.');
      return;
    }
    try {
      const handle = await picker({
        suggestedName: `daybook-autobackup-${today}.json`,
        types: [{ description: 'JSON backup', accept: { 'application/json': ['.json'] } }]
      });
      await saveBackupHandle(handle);
      setBackupHandle(handle);
      await writeBackup(handle, data, setBackupStatus);
      flashMessage('Auto backup file selected.');
    } catch {
      setBackupStatus('Auto backup setup was cancelled.');
    }
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<DayBookData>;
      setData((current) => {
        setUndoData(current);
        return mergeImportedData(current, parsed);
      });
      flashMessage('Imported JSON data.');
    } catch {
      flashMessage('Import failed. Pick a valid DayBook JSON file.');
    }
  }

  function clearAllData() {
    setUndoData(data);
    setData(emptyData);
    setExpandedTasks({});
    setExpandedProjects({});
    setExpandedActivity(false);
    notified.current.clear();
    notifiedWeeklyLogs.current.clear();
    flashMessage('All local DayBook data removed.');
  }

  const selectedKnowledge = data.notes.find((note) => note.id === selectedKnowledgeId);
  if (selectedKnowledge) {
    return (
      <main className="shell noteFullPage">
        <div className={`notice ${message ? 'show' : ''}`} aria-live="polite">{message}</div>
        <article className="panel noteReader">
          <div className="cardHead">
            <div>
              <button type="button" onClick={() => { setSelectedKnowledgeId(''); setEditingSelectedKnowledge(false); }}>Back to knowledge</button>
              <h1>{selectedKnowledge.title}</h1>
            </div>
            <div className="rowActions">
              {undoData ? <button type="button" className="iconButton" aria-label="Undo last change" onClick={undoLastChange}>↶</button> : null}
              <button type="button" className="iconButton" aria-label={`Edit ${selectedKnowledge.title}`} onClick={() => setEditingSelectedKnowledge((value) => !value)}>✎</button>
              <button type="button" className="iconButton" aria-label={`Delete ${selectedKnowledge.title}`} onClick={() => { deleteNote(selectedKnowledge); setSelectedKnowledgeId(''); }}>🗑</button>
            </div>
          </div>
          <Meta tags={selectedKnowledge.tags} />
          {editingSelectedKnowledge ? <KnowledgeForm title="Edit note" note={selectedKnowledge} onSubmit={(event) => { updateNote(event, selectedKnowledge.id); setEditingSelectedKnowledge(false); }} /> : <p className="preline">{selectedKnowledge.body}</p>}
        </article>
      </main>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Main features">
        <div className="brand">
          <h1>DayBook</h1>
          <p>Local work journal</p>
        </div>
        <nav>
          {navItems.map((item) => (
            <button className={page === item.page ? 'active' : ''} type="button" key={item.page} onClick={() => setPage(item.page)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="shell">
        <header className="topbar">
          <div>
            <h1>{currentPage?.label}</h1>
            <p className="pageSubhead">{currentPage ? pageDescriptions[currentPage.page] : ''}</p>
          </div>
        </header>

        <div className={`notice ${message ? 'show' : ''}`} aria-live="polite">{message}</div>
        {undoData ? <button type="button" className="undoButton" onClick={undoLastChange}>Undo last change</button> : null}

        {page === 'dashboard' && (
          <Dashboard
            data={data}
            today={today}
            todayLabel={todayLabel}
            projectsById={projectsById}
            setPage={setPage}
            addCapture={addCapture}
            convertCapture={convertCapture}
            deleteCapture={deleteCapture}
            expandedDashboardTasks={expandedDashboardTasks}
            setExpandedDashboardTasks={setExpandedDashboardTasks}
            expandedActivity={expandedActivity}
            setExpandedActivity={setExpandedActivity}
          />
        )}
        {page === 'tasks' && <TasksPage data={data} addTask={addTask} updateTask={updateTask} toggleTask={toggleTask} deleteTask={deleteTask} expandedTasks={expandedTasks} setExpandedTasks={setExpandedTasks} />}
        {page === 'projects' && <ProjectsPage data={data} projectTabs={projectTabs} setProjectTabs={setProjectTabs} addProject={addProject} updateProject={updateProject} deleteProject={deleteProject} addProjectTask={addProjectTask} updateTask={updateTask} toggleTask={toggleTask} deleteTask={deleteTask} expandedProjects={expandedProjects} setExpandedProjects={setExpandedProjects} />}
        {page === 'scratchpad' && <ScratchpadPage items={data.scratchpadItems} addScratchpadItem={addScratchpadItem} toggleScratchpadItem={toggleScratchpadItem} updateScratchpadItem={updateScratchpadItem} deleteScratchpadItem={deleteScratchpadItem} />}
        {page === 'knowledge' && <KnowledgePage notes={data.notes} prefill={prefill.knowledge} addNote={addNote} openNote={(id) => { setSelectedKnowledgeId(id); setEditingSelectedKnowledge(false); }} />}
        {page === 'glossary' && <GlossaryPage glossary={data.glossary} addGlossary={addGlossary} updateGlossary={updateGlossary} deleteGlossary={deleteGlossary} />}
        {page === 'weekly' && <WeeklyLogsPage data={data} weekDate={weekDate} setWeekDate={setWeekDate} draft={weeklyDraft} setDraft={setWeeklyDraft} saveWeeklyLog={saveWeeklyLog} deleteWeeklyLog={deleteWeeklyLog} />}
        {page === 'systems' && <SystemsPage systems={data.systems} addSystem={addSystem} updateSystem={updateSystem} deleteSystem={deleteSystem} />}
        {page === 'troubleshooting' && <TroubleshootingPage entries={data.troubleshooting} prefill={prefill.troubleshooting} addTroubleshooting={addTroubleshooting} updateTroubleshooting={updateTroubleshooting} deleteTroubleshooting={deleteTroubleshooting} />}
        {page === 'questions' && <QuestionsPage questions={data.questions} prefill={prefill.questions} addQuestion={addQuestion} updateQuestion={updateQuestion} deleteQuestion={deleteQuestion} />}
        {page === 'search' && <SearchPage data={data} query={query} setQuery={setQuery} />}
        {page === 'settings' && <SettingsPage data={data} exportJson={exportJson} importJson={importJson} chooseBackupFile={chooseBackupFile} backupStatus={backupStatus} enableNotifications={enableNotifications} settings={data.settings} updateSettings={(settings) => setData((current) => ({ ...current, settings }))} clearAllData={clearAllData} />}
      </main>
    </div>
  );
}

function Dashboard({ data, today, todayLabel, projectsById, setPage, addCapture, convertCapture, deleteCapture, expandedDashboardTasks, setExpandedDashboardTasks, expandedActivity, setExpandedActivity }: {
  data: DayBookData;
  today: string;
  todayLabel: string;
  projectsById: Map<string, Project>;
  setPage: (page: Page) => void;
  addCapture: (event: FormEvent<HTMLFormElement>) => void;
  convertCapture: (capture: QuickCapture, target: PrefillTarget) => void;
  deleteCapture: (capture: QuickCapture) => void;
  expandedDashboardTasks: boolean;
  setExpandedDashboardTasks: Dispatch<SetStateAction<boolean>>;
  expandedActivity: boolean;
  setExpandedActivity: Dispatch<SetStateAction<boolean>>;
}) {
  const { start, end } = getWeekBounds();
  const inWeek = (value: string) => new Date(value) >= start && new Date(value) <= end;
  const openTasks = data.tasks.filter((task) => task.status !== 'done');
  const todayTasks = openTasks.filter((task) => task.dueAt.slice(0, 10) === today);
  const expiredTasks = openTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < Date.now());
  const currentWeekLog = data.weeklyLogs.find((log) => log.weekStart === formatDateInput(start));
  const weekLabel = formatWeekRange(start, end);
  const dashboardStats = [
    { key: 'today', label: 'Today', count: todayTasks.length, emoji: 'Due today', onClick: () => setPage('tasks') },
    { key: 'knowledge', label: 'Notes', count: data.notes.filter((note) => inWeek(note.createdAt)).length, emoji: 'This week', onClick: () => setPage('knowledge') },
    { key: 'solved', label: 'Fixes', count: data.troubleshooting.filter((entry) => entry.dateResolved && inWeek(`${entry.dateResolved}T12:00:00`)).length, emoji: 'This week', onClick: () => setPage('troubleshooting') },
    { key: 'questions', label: 'Questions', count: data.questions.filter((question) => question.status !== 'Answered').length, emoji: 'Open', onClick: () => setPage('questions') },
    { key: 'expired', label: 'Overdue', count: expiredTasks.length, emoji: 'Needs action', onClick: () => setPage('tasks') }
  ];
  const recentTasks = [...data.tasks].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return (
    <>
      <section className="weekHero" aria-label="Current week">
        <div>
          <p className="eyebrow">This week</p>
          <h2>{weekLabel}</h2>
          <p className="pageSubhead">Today: {todayLabel}</p>
        </div>
        <button type="button" onClick={() => setPage('weekly')}>{currentWeekLog ? 'Open weekly log' : 'Start weekly log'}</button>
      </section>
      <section className="statsBand">
        <div className="stats">
          {dashboardStats.map((item) => (
            <button className="statButton" type="button" key={item.key} onClick={item.onClick}>
              <strong className={`statCard ${item.key}`}>
                <span className="statLabel">{item.label}</span>
                <span className="statValue">{item.count}</span>
                <span className="statMeta">{item.emoji}</span>
              </strong>
            </button>
          ))}
        </div>
      </section>

      <section className="dashboardGrid">
        <Panel title="Quick capture">
          <form onSubmit={addCapture}>
            <label>Capture<textarea name="text" rows={4} placeholder="Paste a term, error, decision, question, or meeting note..." required /></label>
            <label>Tags<input name="tags" placeholder="pipeline, sql" /></label>
            <button type="submit">Capture</button>
          </form>
          <CaptureList captures={data.captures.slice(0, 5)} convertCapture={convertCapture} deleteCapture={deleteCapture} />
        </Panel>
        <Panel title="Task overview">
          <TaskList tasks={expandedDashboardTasks ? recentTasks : recentTasks.slice(0, 3)} projectsById={projectsById} empty="No tasks yet." compact />
          {recentTasks.length > 3 ? <button style={{ marginTop: '16px' }} type="button" onClick={() => setExpandedDashboardTasks((value) => !value)}>{expandedDashboardTasks ? 'Show less' : 'Show more'}</button> : null}
        </Panel>
        <Panel title="Latest activity">
          <ActivityList activities={data.activities} expanded={expandedActivity} onToggleExpanded={() => setExpandedActivity((value) => !value)} />
        </Panel>
      </section>
    </>
  );
}

function TasksPage({ data, addTask, updateTask, toggleTask, deleteTask, expandedTasks, setExpandedTasks }: {
  data: DayBookData;
  addTask: (event: FormEvent<HTMLFormElement>) => void;
  updateTask: (event: FormEvent<HTMLFormElement>, id: string) => void;
  toggleTask: (task: Task) => void;
  deleteTask: (task: Task) => void;
  expandedTasks: Record<string, boolean>;
  setExpandedTasks: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  const projectsById = new Map(data.projects.map((project) => [project.id, project]));
  const [showCreate, setShowCreate] = useState(data.tasks.length === 0);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedMonth, setCompletedMonth] = useState('');
  const open = sortTasksByDue(data.tasks.filter((task) => task.status !== 'done'));
  const done = sortTasksByDue(data.tasks.filter((task) => task.status === 'done'));
  const completedMonths = listTaskMonths(done);
  const visibleDone = completedMonth ? done.filter((task) => taskMonth(task) === completedMonth) : done;
  return (
    <section className="stack">
      <div className="pageActions"><div /><button type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Hide new task' : 'Create new task'}</button></div>
      {showCreate ? <TaskForm title="Add task" onSubmit={(event) => { addTask(event); setShowCreate(false); }} projects={data.projects} onCancel={() => setShowCreate(false)} /> : null}
      <Panel title="Open tasks"><TaskList tasks={open} projectsById={projectsById} onToggle={toggleTask} onDelete={deleteTask} onUpdate={updateTask} empty="No open tasks." expandedMap={expandedTasks} setExpandedMap={setExpandedTasks} /></Panel>
      <Panel title="Completed tasks">
        <div className="sectionToggle">
          <button type="button" onClick={() => setShowCompleted((value) => !value)}>{showCompleted ? 'Collapse completed tasks' : 'Expand completed tasks'}</button>
          {showCompleted && completedMonths.length > 0 ? (
            <label className="inlineField">Month
              <select value={completedMonth} onChange={(event) => setCompletedMonth(event.target.value)}>
                <option value="">All months</option>
                {completedMonths.map((month) => <option key={month} value={month}>{formatMonthLabel(month)}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        {showCompleted ? <TaskList tasks={visibleDone} projectsById={projectsById} onToggle={toggleTask} onDelete={deleteTask} onUpdate={updateTask} empty="No completed tasks yet." expandedMap={expandedTasks} setExpandedMap={setExpandedTasks} /> : <p className="empty">Completed tasks are hidden until you expand them.</p>}
      </Panel>
    </section>
  );
}

function ProjectsPage({ data, projectTabs, setProjectTabs, addProject, updateProject, deleteProject, addProjectTask, updateTask, toggleTask, deleteTask, expandedProjects, setExpandedProjects }: {
  data: DayBookData;
  projectTabs: Record<string, ProjectTab>;
  setProjectTabs: (tabs: Record<string, ProjectTab>) => void;
  addProject: (event: FormEvent<HTMLFormElement>) => void;
  updateProject: (event: FormEvent<HTMLFormElement>, id: string) => void;
  deleteProject: (project: Project) => void;
  addProjectTask: (event: FormEvent<HTMLFormElement>, project: Project, stageName?: string) => void;
  updateTask: (event: FormEvent<HTMLFormElement>, id: string) => void;
  toggleTask: (task: Task) => void;
  deleteTask: (task: Task) => void;
  expandedProjects: Record<string, boolean>;
  setExpandedProjects: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  const [showCreate, setShowCreate] = useState(data.projects.length === 0);
  return (
    <section className="stack">
      <div className="pageActions"><div /><button type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Hide new project' : 'Create new project'}</button></div>
      {showCreate ? <ProjectForm title="New project" onSubmit={(event) => { addProject(event); setShowCreate(false); }} onCancel={() => setShowCreate(false)} /> : null}
      <div className="taskList">
        {data.projects.length === 0 ? <p className="empty">No projects yet.</p> : data.projects.map((project) => {
          const tab = projectTabs[project.id] ?? 'overview';
          const subtasks = data.tasks.filter((task) => task.projectId === project.id);
          const stages = parseProjectTimeline(project.timeline);
          const expanded = expandedProjects[project.id] ?? false;
          const editing = expandedProjects[`${project.id}:edit`] ?? false;
          return (
            <article className="card" key={project.id}>
              <div className="cardHead">
                <h3>{project.name}</h3>
                <div className="cardActions">
                  <button type="button" className="iconButton" title={expanded ? 'Hide details' : 'Show details'} aria-label={expanded ? `Hide ${project.name} details` : `Show ${project.name} details`} onClick={() => setExpandedProjects((current) => ({ ...current, [project.id]: !expanded }))}>{expanded ? '▴' : '▾'}</button>
                  <button type="button" className="iconButton" title="Edit project" aria-label={`Edit ${project.name}`} onClick={() => setExpandedProjects((current) => ({ ...current, [`${project.id}:edit`]: !editing, [project.id]: true }))}>✎</button>
                  <button type="button" className="iconButton" title="Delete" aria-label={`Delete ${project.name}`} onClick={() => deleteProject(project)}>🗑</button>
                </div>
              </div>
              <ProjectSummary project={project} tasks={subtasks} showOverview={!expanded} />
              {!expanded ? null : (
                <>
                  <div className="tabs">
                    {(['overview', 'tasks', 'timeline'] as ProjectTab[]).map((item) => <button className={tab === item ? 'active' : ''} type="button" key={item} onClick={() => setProjectTabs({ ...projectTabs, [project.id]: item })}>{item}</button>)}
                  </div>
                  {tab === 'overview' && <DetailBlock label="Overview" value={project.overview || 'No overview yet.'} />}
                  {tab === 'tasks' && <ProjectStageTasks stages={stages} tasks={subtasks} projects={data.projects} expandedTasks={expandedProjects} setExpandedTasks={setExpandedProjects} addProjectTask={(event, stageName) => addProjectTask(event, project, stageName)} updateTask={updateTask} toggleTask={toggleTask} deleteTask={deleteTask} />}
                  {tab === 'timeline' && <ProjectTimeline timeline={project.timeline} chartOnly />}
                  {editing ? <ProjectForm title="Edit project" project={project} onSubmit={(event) => updateProject(event, project.id)} onCancel={() => setExpandedProjects((current) => ({ ...current, [`${project.id}:edit`]: false }))} /> : null}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ScratchpadPage({ items, addScratchpadItem, toggleScratchpadItem, updateScratchpadItem, deleteScratchpadItem }: {
  items: ScratchpadItem[];
  addScratchpadItem: (event: FormEvent<HTMLFormElement>) => void;
  toggleScratchpadItem: (item: ScratchpadItem) => void;
  updateScratchpadItem: (event: FormEvent<HTMLFormElement>, id: string) => void;
  deleteScratchpadItem: (item: ScratchpadItem) => void;
}) {
  const openItems = items.filter((item) => !item.done);
  const doneItems = items.filter((item) => item.done);
  return (
    <section className="grid">
      <form className="panel" onSubmit={addScratchpadItem}>
        <h2>Add to scratchpad</h2>
        <label>Write anything<textarea name="title" rows={4} required placeholder="..." /></label>
        <button type="submit">Save to scratchpad</button>
      </form>
      <div className="stack">
        <Panel title="Open">
          <ScratchpadList items={openItems} empty="Nothing in the scratchpad yet." toggleScratchpadItem={toggleScratchpadItem} updateScratchpadItem={updateScratchpadItem} deleteScratchpadItem={deleteScratchpadItem} />
        </Panel>
        <details className="panel">
          <summary>Done ({doneItems.length})</summary>
          <ScratchpadList items={doneItems} empty="No done scratchpad items yet." toggleScratchpadItem={toggleScratchpadItem} updateScratchpadItem={updateScratchpadItem} deleteScratchpadItem={deleteScratchpadItem} />
        </details>
      </div>
    </section>
  );
}

function ScratchpadList({ items, empty, toggleScratchpadItem, updateScratchpadItem, deleteScratchpadItem }: {
  items: ScratchpadItem[];
  empty: string;
  toggleScratchpadItem: (item: ScratchpadItem) => void;
  updateScratchpadItem: (event: FormEvent<HTMLFormElement>, id: string) => void;
  deleteScratchpadItem: (item: ScratchpadItem) => void;
}) {
  const [editingId, setEditingId] = useState('');
  if (items.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div className="taskList">
      {items.map((item) => (
        <article className={`card ${item.done ? 'done' : ''}`} key={item.id}>
          <div className="cardHead">
            <label className="check"><input type="checkbox" checked={item.done} onChange={() => toggleScratchpadItem(item)} /><span>{item.title}</span></label>
            <div className="cardActions">
              <button type="button" className="iconButton" title="Edit" aria-label={`Edit ${item.title}`} onClick={() => setEditingId((current) => current === item.id ? '' : item.id)}>✎</button>
              <button type="button" className="iconButton" title="Delete" aria-label={`Delete ${item.title}`} onClick={() => deleteScratchpadItem(item)}>🗑</button>
            </div>
          </div>
          {editingId === item.id ? (
            <form className="inlineEditForm" onSubmit={(event) => { updateScratchpadItem(event, item.id); setEditingId(''); }}>
              <label>Edit scratchpad item<textarea name="title" rows={3} required defaultValue={item.title} /></label>
              <div className="formActions"><button type="submit">Save</button><button type="button" onClick={() => setEditingId('')}>Cancel</button></div>
            </form>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function KnowledgePage({ notes, prefill, addNote, openNote }: {
  notes: Note[];
  prefill?: string;
  addNote: (event: FormEvent<HTMLFormElement>) => void;
  openNote: (id: string) => void;
}) {
  const [noteQuery, setNoteQuery] = useState('');
  const query = noteQuery.toLowerCase();
  const visibleNotes = notes.filter((note) => [note.title, note.body, note.tags.join(' ')].join(' ').toLowerCase().includes(query));
  return (
    <section className="grid">
      <KnowledgeForm title="Add knowledge note" prefill={prefill} onSubmit={addNote} />
      <Panel title="Saved notes">
        <label className="search">Search notes<input value={noteQuery} onChange={(event) => setNoteQuery(event.target.value)} placeholder="..." /></label>
        <div className="compactRows">
          {visibleNotes.length === 0 ? <p className="empty">{notes.length === 0 ? 'No knowledge notes yet.' : 'No matching notes.'}</p> : visibleNotes.map((note) => (
            <article className="compactRow" key={note.id}>
              <button type="button" className="noteTitleButton" onClick={() => openNote(note.id)}>{note.title}</button>
            </article>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function GlossaryPage({ glossary, addGlossary, updateGlossary, deleteGlossary }: {
  glossary: GlossaryEntry[];
  addGlossary: (event: FormEvent<HTMLFormElement>) => void;
  updateGlossary: (event: FormEvent<HTMLFormElement>, id: string) => void;
  deleteGlossary: (entry: GlossaryEntry) => void;
}) {
  const [query, setQuery] = useState('');
  const [editingGlossaryId, setEditingGlossaryId] = useState('');
  const groups = groupGlossary(filterList(glossary, query, (entry) => [entry.term, entry.meaning, entry.context]));
  return (
    <section className="grid">
      <GlossaryForm onSubmit={addGlossary} />
      <div>
        <label className="search">Search glossary<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="yield, lot, SPC..." /></label>
        <div className="glossaryJump">
          {groups.map(([letter]) => <a href={`#glossary-${letter}`} key={letter}>{letter}</a>)}
        </div>
        <div className="glossaryList">
          {groups.length === 0 ? <p className="empty">{glossary.length === 0 ? 'No glossary terms yet.' : 'No matching terms.'}</p> : groups.map(([letter, entries]) => (
            <section className="glossaryGroup" id={`glossary-${letter}`} key={letter}>
              <h2>{letter}</h2>
              {entries.map((entry) => (
                <article className="compactRow" key={entry.id}>
                  <details>
                    <summary><span>{glossaryTitle(entry)}</span></summary>
                    <div className="rowActions">
                      <button type="button" className="iconButton" aria-label={`Edit ${entry.term}`} onClick={() => setEditingGlossaryId((current) => current === entry.id ? '' : entry.id)}>✎</button>
                      <button type="button" className="iconButton" aria-label={`Delete ${entry.term}`} onClick={() => deleteGlossary(entry)}>🗑</button>
                    </div>
                    {entry.context ? <DetailBlock label="Details" value={entry.context} /> : <p className="empty">No details yet.</p>}
                    {editingGlossaryId === entry.id ? <GlossaryForm title="Edit glossary term" entry={entry} onSubmit={(event) => updateGlossary(event, entry.id)} /> : null}
                  </details>
                </article>
              ))}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

function WeeklyLogsPage({ data, weekDate, setWeekDate, draft, setDraft, saveWeeklyLog, deleteWeeklyLog }: {
  data: DayBookData;
  weekDate: string;
  setWeekDate: (value: string) => void;
  draft: WeeklyLog;
  setDraft: Dispatch<SetStateAction<WeeklyLog>>;
  saveWeeklyLog: (event: FormEvent<HTMLFormElement>) => void;
  deleteWeeklyLog: (log: WeeklyLog) => void;
}) {
  const [monthFilter, setMonthFilter] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [editingLogId, setEditingLogId] = useState('');
  const editorRef = useRef<HTMLFormElement | null>(null);
  const selectedWeekStart = weekFilter ? formatDateInput(getWeekBounds(new Date(`${weekFilter}T12:00:00`)).start) : '';
  const monthOptions = listWeeklyLogMonths(data.weeklyLogs);
  const visibleLogs = data.weeklyLogs.filter((log) => (!monthFilter || log.weekStart.startsWith(monthFilter)) && (!selectedWeekStart || log.weekStart === selectedWeekStart));
  const editLog = (log: WeeklyLog) => {
    setEditingLogId(log.id);
    setWeekDate(log.weekStart);
    setDraft(log);
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      editorRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    });
  };
  const clearEdit = () => {
    setEditingLogId('');
    const weekStart = formatDateInput(getWeekBounds(new Date(`${weekDate}T12:00:00`)).start);
    setDraft(emptyWeeklyLog(weekStart, new Date().toISOString()));
  };
  const saveAndReset = (event: FormEvent<HTMLFormElement>) => {
    saveWeeklyLog(event);
    setEditingLogId('');
    const weekStart = formatDateInput(getWeekBounds(new Date(`${weekDate}T12:00:00`)).start);
    setDraft(emptyWeeklyLog(weekStart, new Date().toISOString()));
  };
  return (
    <section className="stack">
      <details className="panel" open={Boolean(editingLogId)}>
        <summary>{editingLogId ? `Editing ${weeklyLogTitle(draft)}` : 'Add weekly log'}</summary>
        <form onSubmit={saveAndReset} ref={editorRef}>
          <div className="rowPanel">
            <label>Pick week by date<input type="date" value={weekDate} onChange={(event) => setWeekDate(event.target.value)} /></label>
            {editingLogId ? <button type="button" onClick={clearEdit}>Cancel edit</button> : null}
          </div>
          <h2>{weeklyLogTitle(draft)}</h2>
          <WeeklyField label="Learned" value={draft.learned} onChange={(value) => setDraft((current) => ({ ...current, learned: value }))} />
          <WeeklyField label="Worked on" value={draft.workedOn} onChange={(value) => setDraft((current) => ({ ...current, workedOn: value }))} />
          <WeeklyField label="Problems / blockers" value={draft.blockers} onChange={(value) => setDraft((current) => ({ ...current, blockers: value }))} />
          <WeeklyField label="Problems solved / contribution" value={weeklyContribution(draft)} onChange={(value) => setDraft((current) => ({ ...current, solved: '', impact: value }))} />
          <WeeklyField label="Next week priorities" value={draft.nextWeek} onChange={(value) => setDraft((current) => ({ ...current, nextWeek: value }))} />
          <button type="submit">Save weekly log</button>
        </form>
      </details>
      <Panel title="Saved weekly logs">
        <div className="rowPanel">
          <label>Month<input type="month" value={monthFilter} list="weekly-log-months" onChange={(event) => setMonthFilter(event.target.value)} /></label>
          <label>Specific week<input type="date" value={weekFilter} onChange={(event) => setWeekFilter(event.target.value)} /></label>
          {monthFilter || weekFilter ? <button type="button" onClick={() => { setMonthFilter(''); setWeekFilter(''); }}>Clear filters</button> : null}
          <datalist id="weekly-log-months">{monthOptions.map((month) => <option value={month} key={month}>{formatMonthLabel(month)}</option>)}</datalist>
        </div>
        {data.weeklyLogs.length === 0 ? <p className="empty">No weekly logs yet.</p> : visibleLogs.length === 0 ? <p className="empty">No matching weekly logs.</p> : visibleLogs.map((log) => (
          <article className="compactRow" key={log.id}>
            <details>
              <summary><span>{weeklyLogTitle(log)}</span></summary>
              <div className="rowActions">
                <button type="button" className="iconButton" title="Edit" aria-label={`Edit ${weeklyLogTitle(log)}`} onClick={() => editLog(log)}>✎</button>
                <button type="button" className="iconButton" aria-label={`Delete ${weeklyLogTitle(log)}`} onClick={() => deleteWeeklyLog(log)}>🗑</button>
              </div>
              <WeeklyLogDetails log={log} />
            </details>
          </article>
        ))}
      </Panel>
    </section>
  );
}

function WeeklyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label>{label}<textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} placeholder="One item per line" /></label>;
}

function WeeklyLogDetails({ log }: { log: WeeklyLog }) {
  const sections = weeklyLogSections(log);
  if (sections.length === 0) return <p className="empty">No notes saved for this week.</p>;
  return (
    <div className="weeklyLogDetails">
      {sections.map(([label, value]) => (
        <section key={label}>
          <h3>{label}</h3>
          <p className="preline">{value}</p>
        </section>
      ))}
    </div>
  );
}

function SystemsPage({ systems, addSystem, updateSystem, deleteSystem }: {
  systems: SystemEntry[];
  addSystem: (event: FormEvent<HTMLFormElement>) => void;
  updateSystem: (event: FormEvent<HTMLFormElement>, id: string) => void;
  deleteSystem: (system: SystemEntry) => void;
}) {
  const [showCreate, setShowCreate] = useState(systems.length === 0);
  return (
    <section className="stack">
      <div className="pageActions"><div /><button type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Hide new system' : 'Document system'}</button></div>
      {showCreate ? <SystemForm title="Document system" onSubmit={(event) => { addSystem(event); setShowCreate(false); }} /> : null}
      <div className="taskList">
        {systems.length === 0 ? <p className="empty">No systems documented yet.</p> : systems.map((system) => (
          <article className="card" key={system.id}>
            <div className="cardHead"><h3>{system.name}</h3><button type="button" onClick={() => deleteSystem(system)}>Delete</button></div>
            <p>{system.purpose}</p>
            <details><summary>Details</summary><SystemDetails system={system} /><SystemForm title="Edit system" system={system} onSubmit={(event) => updateSystem(event, system.id)} /></details>
          </article>
        ))}
      </div>
    </section>
  );
}

function TroubleshootingPage({ entries, prefill, addTroubleshooting, updateTroubleshooting, deleteTroubleshooting }: {
  entries: TroubleshootingEntry[];
  prefill?: string;
  addTroubleshooting: (event: FormEvent<HTMLFormElement>) => void;
  updateTroubleshooting: (event: FormEvent<HTMLFormElement>, id: string) => void;
  deleteTroubleshooting: (entry: TroubleshootingEntry) => void;
}) {
  const [filter, setFilter] = useState('');
  const visible = filterList(entries, filter, (entry) => [entry.title, entry.symptoms, entry.error, entry.rootCause, entry.solution, entry.relatedSystem, entry.tags.join(' ')]);
  return (
    <section className="grid">
      <TroubleshootingForm title="Add troubleshooting entry" prefill={prefill} onSubmit={addTroubleshooting} />
      <div>
        <label className="search">Search troubleshooting<input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="error, system, root cause..." /></label>
        <div className="notes">
          {visible.map((entry) => (
            <article className="card" key={entry.id}>
              <div className="cardHead"><h3>{entry.title}</h3><button type="button" onClick={() => deleteTroubleshooting(entry)}>Delete</button></div>
              <p><span className="badge done">{entry.dateResolved || 'No date'}</span> {entry.relatedSystem}</p>
              <DetailBlock label="What happened" value={entry.symptoms || 'No notes yet.'} />
              {entry.rootCause ? <DetailBlock label="Root cause" value={entry.rootCause} /> : null}
              {entry.solution ? <DetailBlock label="Fix / lesson learned" value={entry.solution} /> : null}
              <Meta tags={entry.tags} />
              <details><summary>Edit</summary><TroubleshootingForm title="Edit troubleshooting entry" entry={entry} onSubmit={(event) => updateTroubleshooting(event, entry.id)} /></details>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuestionsPage({ questions, prefill, addQuestion, updateQuestion, deleteQuestion }: {
  questions: QuestionEntry[];
  prefill?: string;
  addQuestion: (event: FormEvent<HTMLFormElement>) => void;
  updateQuestion: (event: FormEvent<HTMLFormElement>, id: string) => void;
  deleteQuestion: (question: QuestionEntry) => void;
}) {
  const [query, setQuery] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState('');
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const visibleQuestions = filterList(questions, query, (question) => [question.question, question.status, question.relatedSystem, question.notes]);
  const selectedQuestion = questions.find((question) => question.id === selectedQuestionId);
  return (
    <section className="grid questionPage">
      <QuestionForm title="Quick question" prefill={prefill} onSubmit={addQuestion} />
      <Panel title="Questions">
        <label className="search">Search questions<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="owner, blocker, answer..." /></label>
        <div className="questionCards">
          {visibleQuestions.length === 0 ? <p className="empty">{questions.length === 0 ? 'No questions yet.' : 'No matching questions.'}</p> : visibleQuestions.map((question) => (
            <button type="button" className="questionCardButton" key={question.id} onClick={() => { setSelectedQuestionId(question.id); setEditingQuestionId(''); }}><span>{question.question}</span><span className={`badge ${question.status === 'Answered' ? 'done' : 'todo'}`}>{question.status}</span></button>
          ))}
        </div>
      </Panel>
      {selectedQuestion ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="question-dialog-title" onClick={() => setSelectedQuestionId('')}>
          <article className="modalCard questionModal" onClick={(event) => event.stopPropagation()}>
            <div className="cardHead">
              <h3 id="question-dialog-title">{selectedQuestion.question}</h3>
              <div className="cardActions">
                <button type="button" className="iconButton" title="Edit" aria-label={`Edit ${selectedQuestion.question}`} onClick={() => setEditingQuestionId((current) => current === selectedQuestion.id ? '' : selectedQuestion.id)}>✎</button>
                <button type="button" className="iconButton" title="Delete" aria-label={`Delete ${selectedQuestion.question}`} onClick={() => { deleteQuestion(selectedQuestion); setSelectedQuestionId(''); }}>🗑</button>
                <button type="button" className="iconButton" title="Close" aria-label="Close question details" onClick={() => setSelectedQuestionId('')}>←</button>
              </div>
            </div>
            <p><span className={`badge ${selectedQuestion.status === 'Answered' ? 'done' : 'todo'}`}>{selectedQuestion.status}</span></p>
            {selectedQuestion.relatedSystem ? <DetailBlock label="Related system" value={selectedQuestion.relatedSystem} /> : null}
            <DetailBlock label="Answer" value={questionPreview(selectedQuestion)} />
            {editingQuestionId === selectedQuestion.id ? <QuestionForm title="Edit question" question={selectedQuestion} onSubmit={(event) => updateQuestion(event, selectedQuestion.id)} compact /> : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}

function SearchPage({ data, query, setQuery }: { data: DayBookData; query: string; setQuery: (value: string) => void }) {
  const results = useMemo(() => searchData(data, query), [data, query]);
  return (
    <section className="stack">
      <Panel title="Global search">
        <label className="search">Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="pipeline, SQL error, system owner..." autoFocus /></label>
      </Panel>
      <div className="notes">
        {results.length === 0 ? <p className="empty">No matching records.</p> : results.map((result) => (
          <article className="card" key={`${result.type}-${result.id}`}>
            <p className="eyebrow">{result.type}</p>
            <h3>{result.title}</h3>
            <p>{result.detail}</p>
            <Meta tags={result.tags} />
          </article>
        ))}
      </div>
    </section>
  );
}

function SettingsPage({ data, exportJson, importJson, chooseBackupFile, backupStatus, enableNotifications, settings, updateSettings, clearAllData }: {
  data: DayBookData;
  exportJson: () => void;
  importJson: (file: File | undefined) => void;
  chooseBackupFile: () => Promise<void>;
  backupStatus: string;
  enableNotifications: () => Promise<void>;
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => void;
  clearAllData: () => void;
}) {
  return (
    <section className="grid">
      <Panel title="Notifications"><p>Allow browser notifications for local reminders while DayBook is open.</p><button type="button" onClick={enableNotifications}>Enable reminders</button></Panel>
      <Panel title="Appearance">
        <label>Application theme
          <select value={settings.theme} onChange={(event) => updateSettings({ ...settings, theme: event.target.value as AppSettings['theme'] })}>
            <option value="mint">Mint</option><option value="sage">Sage</option><option value="cream">Cream</option><option value="sky">Sky</option><option value="rose">Rose</option><option value="graphite">Graphite</option>
          </select>
        </label>
        <label>Display density
          <select value={settings.density} onChange={(event) => updateSettings({ ...settings, density: event.target.value as AppSettings['density'] })}>
            <option value="comfortable">Comfortable</option><option value="compact">Compact</option>
          </select>
        </label>
      </Panel>
      <Panel title="Backup"><p>DayBook saves your work in this browser automatically. For a file copy, export before closing or choose a backup file when the browser still has permission.</p><p className="metaLine">{backupStatus}</p><div className="formActions"><button type="button" onClick={exportJson}>Export JSON</button><button type="button" onClick={chooseBackupFile}>Choose backup file</button></div></Panel>
      <Panel title="Import"><p>Import merges the selected DayBook JSON file into the current local data.</p><input type="file" accept="application/json" onChange={(event) => importJson(event.target.files?.[0])} /></Panel>
      <Panel title="Local data"><button type="button" className="dangerButton" onClick={clearAllData}>Clear all local data</button></Panel>
    </section>
  );
}

function TaskForm({ title, task, projects, onSubmit, onCancel }: {
  title: string;
  task?: Task;
  projects: Project[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2>{title}</h2>
      <label>Title<input name="title" required defaultValue={task?.title} placeholder="Prepare pipeline review" /></label>
      <label>Status<select name="status" defaultValue={task?.status ?? 'todo'}><option value="todo">To-do</option><option value="in-progress">In progress</option><option value="done">Done</option></select></label>
      <label>Deadline<input name="dueAt" type="datetime-local" defaultValue={task?.dueAt} /></label>
      <label>Reminder<input name="reminderAt" type="datetime-local" defaultValue={task?.reminderAt} /></label>
      <label>Project<select name="projectId" defaultValue={task?.projectId ?? ''}><option value="">No project</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label>
      <label>Tags<input name="tags" defaultValue={task?.tags.join(', ')} placeholder="pipeline, onboarding" /></label>
      <label>Roadblock<input name="roadblock" defaultValue={task?.roadblock} placeholder="Waiting for access" /></label>
      <label>Notes<textarea name="notes" rows={3} defaultValue={task?.notes} placeholder="What needs to happen?" /></label>
      <div className="formActions"><button type="submit">{task ? 'Save task' : 'Add task'}</button><button type="button" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function KnowledgeForm({ title, note, prefill, onSubmit }: { title: string; note?: Note; prefill?: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className={note ? 'inlineEditForm' : 'panel'} onSubmit={onSubmit} key={prefill ?? note?.id ?? 'knowledge'}>
      <h2>{title}</h2>
      <label>Title<input name="title" placeholder="Pipeline trigger mechanism" required defaultValue={note?.title} /></label>
      <label>Tags<input name="tags" list="note-tags" placeholder="pipeline, sql" defaultValue={note?.tags.join(', ')} /></label>
      <label>Note<textarea name="body" rows={note ? 8 : 12} required defaultValue={note?.body ?? (prefill ? `${prefill}\n\n${standardNoteTemplate}` : standardNoteTemplate)} /></label>
      <datalist id="note-tags">{presetTags.map((tag) => <option key={tag} value={tag} />)}</datalist>
      <button type="submit">{note ? 'Save changes' : 'Save note'}</button>
    </form>
  );
}

function GlossaryForm({ title = 'Add glossary term', entry, onSubmit }: { title?: string; entry?: GlossaryEntry; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className={entry ? 'inlineEditForm' : 'panel'} onSubmit={onSubmit}>
      <h2>{title}</h2>
      <label>Term<input name="term" required placeholder="Yield, SPC, lot..." defaultValue={entry?.term} /></label>
      <label>Meaning<textarea name="meaning" rows={3} required placeholder="Plain-language meaning" defaultValue={entry?.meaning} /></label>
      <label>Details<textarea name="context" rows={3} placeholder="From panel ID and coordinates" defaultValue={entry?.context} /></label>
      <button type="submit">{entry ? 'Save changes' : 'Save term'}</button>
    </form>
  );
}

function ProjectForm({ title, project, onSubmit, onCancel }: { title: string; project?: Project; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const [stages, setStages] = useState(() => {
    const saved = parseProjectTimeline(project?.timeline ?? '');
    return saved.length > 0 ? saved : [{ name: '', start: '', end: '', detail: '' }];
  });
  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2>{title}</h2>
      <label>Name<input name="name" required defaultValue={project?.name} placeholder="Warehouse cost review" /></label>
      <label>Overview<textarea name="overview" rows={3} defaultValue={project?.overview} /></label>
      <ProjectStageFields stages={stages} setStages={setStages} />
      <input type="hidden" name="details" value={project?.details ?? ''} />
      <input type="hidden" name="timeline" value={serializeProjectTimeline(stages)} />
      <div className="formActions"><button type="submit">{project ? 'Save project' : 'Create project'}</button><button type="button" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function ProjectStageFields({ stages, setStages }: {
  stages: ProjectStage[];
  setStages: Dispatch<SetStateAction<ProjectStage[]>>;
}) {
  const updateStage = (index: number, change: Partial<ProjectStage>) => {
    setStages((current) => current.map((stage, stageIndex) => stageIndex === index ? { ...stage, ...change } : stage));
  };
  return (
    <fieldset className="stageFields">
      <legend>Project stages</legend>
      {stages.map((stage, index) => (
        <div className="stageFieldRow" key={index}>
          <label>Stage<input value={stage.name} onChange={(event) => updateStage(index, { name: event.target.value })} placeholder={`Stage ${index + 1}`} /></label>
          <label>Start<input type="date" value={stage.start} onChange={(event) => updateStage(index, { start: event.target.value })} /></label>
          <label>End<input type="date" value={stage.end} onChange={(event) => updateStage(index, { end: event.target.value })} /></label>
          <label>Details<input value={stage.detail} onChange={(event) => updateStage(index, { detail: event.target.value })} placeholder="Gather requirements" /></label>
          <button type="button" onClick={() => setStages((current) => current.length === 1 ? [{ name: '', start: '', end: '', detail: '' }] : current.filter((_, stageIndex) => stageIndex !== index))}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => setStages((current) => [...current, { name: '', start: '', end: '', detail: '' }])}>Add stage</button>
    </fieldset>
  );
}

function ProjectSummary({ project, tasks, showOverview }: { project: Project; tasks: Task[]; showOverview: boolean }) {
  const done = tasks.filter((task) => task.status === 'done').length;
  const open = tasks.length - done;
  return (
    <div className="projectSummary">
      {showOverview ? <p>{project.overview || 'No overview yet.'}</p> : null}
      <div className="projectStats">
        <span>{open} open</span>
        <span>{done} done</span>
      </div>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return <div className="detailBlock"><strong>{label}</strong><p className="preline">{value}</p></div>;
}

function ProjectStageTasks({ stages, tasks, projects, expandedTasks, setExpandedTasks, addProjectTask, updateTask, toggleTask, deleteTask }: {
  stages: ProjectStage[];
  tasks: Task[];
  projects: Project[];
  expandedTasks: Record<string, boolean>;
  setExpandedTasks: Dispatch<SetStateAction<Record<string, boolean>>>;
  addProjectTask: (event: FormEvent<HTMLFormElement>, stageName?: string) => void;
  updateTask: (event: FormEvent<HTMLFormElement>, id: string) => void;
  toggleTask: (task: Task) => void;
  deleteTask: (task: Task) => void;
}) {
  const visibleStages = stages.filter((stage) => stage.name || stage.start || stage.end || stage.detail);
  const taskStage = (task: Task) => task.notes.match(/^Stage:\s*(.+)$/m)?.[1]?.trim() ?? '';
  if (visibleStages.length === 0 && tasks.length === 0) return <p className="empty">No project tasks yet.</p>;
  return (
    <div className="projectDetailsList">
      {visibleStages.map((stage, index) => {
        const title = stage.name || 'Untitled stage';
        const stageTasks = tasks.filter((task) => taskStage(task).toLowerCase() === title.toLowerCase());
        return (
          <details className="stageDetail" key={`${title}-${index}`}>
            <summary>
              <strong>{stage.detail ? `${title} : ${stage.detail}` : title}</strong>
              <span>{stageDateLabel(stage)}</span>
            </summary>
            <TaskList tasks={stageTasks} projectsById={new Map(projects.map((project) => [project.id, project]))} onToggle={toggleTask} onDelete={deleteTask} onUpdate={updateTask} empty="No checklist tasks yet." compact expandedMap={expandedTasks} setExpandedMap={setExpandedTasks} allowCompactEdit />
            <ProjectTaskForm onSubmit={(event) => addProjectTask(event, title)} />
          </details>
        );
      })}
      {tasks.filter((task) => !taskStage(task)).length > 0 ? (
        <details className="stageDetail">
          <summary><strong>Other project tasks</strong></summary>
          <TaskList tasks={tasks.filter((task) => !taskStage(task))} projectsById={new Map(projects.map((project) => [project.id, project]))} onToggle={toggleTask} onDelete={deleteTask} onUpdate={updateTask} empty="No other tasks." compact expandedMap={expandedTasks} setExpandedMap={setExpandedTasks} allowCompactEdit />
        </details>
      ) : null}
    </div>
  );
}

function ProjectTaskForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="projectTaskForm" onSubmit={onSubmit}>
      <input name="title" required placeholder="Add a checklist task" />
      <input name="dueAt" type="datetime-local" aria-label="Deadline" />
      <button type="submit">Add</button>
    </form>
  );
}

function SystemForm({ title, system, onSubmit }: { title: string; system?: SystemEntry; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2>{title}</h2>
      <label>Name<input name="name" required defaultValue={system?.name} /></label>
      <label>Purpose<textarea name="purpose" rows={3} defaultValue={system?.purpose} /></label>
      <label>Owner / team<input name="owner" defaultValue={system?.owner} /></label>
      <label>Data / workflow<textarea name="workflow" rows={4} defaultValue={systemSummary(system)} placeholder="Source data, main flow, important tables or dashboards" /></label>
      <label>Common failures<textarea name="commonFailures" rows={3} defaultValue={system?.commonFailures} /></label>
      <button type="submit">{system ? 'Save system' : 'Create system'}</button>
    </form>
  );
}

function SystemDetails({ system }: { system: SystemEntry }) {
  return <p className="preline">{[
    ['Owner / team', system.owner],
    ['Data / workflow', systemSummary(system)],
    ['Common failures', system.commonFailures]
  ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n\n')}</p>;
}

function TroubleshootingForm({ title, entry, prefill, onSubmit }: { title: string; entry?: TroubleshootingEntry; prefill?: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="panel" onSubmit={onSubmit} key={prefill ?? entry?.id ?? 'troubleshooting'}>
      <h2>{title}</h2>
      <label>Title / problem<input name="title" required defaultValue={entry?.title ?? prefill} /></label>
      <label>What happened<textarea name="symptoms" rows={3} defaultValue={troubleshootingObserved(entry)} /></label>
      <label>Root cause<textarea name="rootCause" rows={3} defaultValue={entry?.rootCause} /></label>
      <label>Fix / lesson learned<textarea name="solution" rows={4} defaultValue={troubleshootingFix(entry)} /></label>
      <label>Related system<input name="relatedSystem" defaultValue={entry?.relatedSystem} /></label>
      <label>Tags<input name="tags" defaultValue={entry?.tags.join(', ')} placeholder="debugging, pipeline" /></label>
      <label>Date resolved<input name="dateResolved" type="date" defaultValue={entry?.dateResolved} /></label>
      <button type="submit">{entry ? 'Save entry' : 'Create entry'}</button>
    </form>
  );
}

function QuestionForm({ title, question, prefill, onSubmit, compact = false }: { title: string; question?: QuestionEntry; prefill?: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; compact?: boolean }) {
  return (
    <form className={compact ? 'inlineEditForm' : 'panel'} onSubmit={onSubmit} key={prefill ?? question?.id ?? 'question'}>
      <h2>{title}</h2>
      <label>Question<input name="question" required defaultValue={question?.question ?? prefill} placeholder="Who owns this table?" /></label>
      <label>Status<select name="status" defaultValue={question?.status ?? 'Open'}><option>Open</option><option>Investigating</option><option>Need to ask</option><option>Answered</option></select></label>
      <label>Related system<input name="relatedSystem" defaultValue={question?.relatedSystem} /></label>
      <label>Notes / answer<textarea name="notes" rows={5} defaultValue={question?.notes} /></label>
      <button type="submit">{question ? 'Save changes' : 'Create question'}</button>
    </form>
  );
}

function ProjectTimeline({ timeline, chartOnly = false }: { timeline: string; chartOnly?: boolean }) {
  const phases = parseProjectTimeline(timeline);
  if (phases.length === 0) return <p>No planned timeline yet.</p>;
  const dated = phases.filter((phase) => phase.start || phase.end);
  const bounds = timelineBounds(dated);
  return (
    <div className="timeline">
      {bounds ? (
        <div className="stageChart">
          {phases.map((phase, index) => {
            const position = stagePosition(phase, bounds.start, bounds.days);
            return (
              <div className="stageChartRow" key={`${phase.name}-${index}`}>
                <span className="timelineLabel">{phase.name || `Stage ${index + 1}`}</span>
                <div className="stageTrack">
                  <span className="stageBar" style={{ left: `${position.left}%`, width: `${position.width}%` }} />
                </div>
                <span className="timelineDetail">{stageDateLabel(phase)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {!chartOnly ? phases.map((phase, index) => (
        <div className="timelineRow" key={`row-${phase.name}-${index}`}>
          <span className="timelineLabel">{phase.name || `Stage ${index + 1}`}</span>
          <span>{stageDateLabel(phase)}</span>
          {phase.detail ? <span className="timelineDetail">{phase.detail}</span> : null}
        </div>
      )) : null}
    </div>
  );
}

type ProjectStage = { name: string; start: string; end: string; detail: string };

export function parseProjectTimeline(timeline: string): ProjectStage[] {
  return timeline.split('\n').map((item) => item.trim()).filter(Boolean).map((line) => {
    const [name, start, third, ...rest] = line.split('|').map((item) => item.trim());
    if (rest.length === 0) return { name, start, end: start, detail: third ?? '' };
    return { name, start, end: third, detail: rest.join(' | ') };
  });
}

export function serializeProjectTimeline(stages: ProjectStage[]) {
  return stages
    .map((stage) => [stage.name, stage.start, stage.end, stage.detail].map((value) => value.trim()))
    .filter(([name, start, end, detail]) => name || start || end || detail)
    .map(([name, start, end, detail]) => [name, start, end, detail].join(' | '))
    .join('\n');
}

function stageDateLabel(stage: ProjectStage) {
  if (stage.start && stage.end) return `${stage.start} - ${stage.end}`;
  if (stage.start) return `${stage.start} - no end date`;
  if (stage.end) return `No start date - ${stage.end}`;
  return 'No dates yet';
}

function timelineBounds(stages: ProjectStage[]) {
  const times = stages.flatMap((stage) => [stage.start, stage.end].filter(Boolean).map((value) => new Date(`${value}T12:00:00`).getTime())).filter(Number.isFinite);
  if (times.length === 0) return null;
  const start = Math.min(...times);
  const end = Math.max(...times);
  return { start, days: Math.max(1, Math.ceil((end - start) / 86_400_000) + 1) };
}

function stagePosition(stage: ProjectStage, chartStart: number, chartDays: number) {
  const startTime = new Date(`${stage.start || stage.end}T12:00:00`).getTime();
  const endTime = new Date(`${stage.end || stage.start}T12:00:00`).getTime();
  const start = Number.isFinite(startTime) ? startTime : chartStart;
  const end = Number.isFinite(endTime) ? endTime : start;
  const left = Math.max(0, ((Math.min(start, end) - chartStart) / 86_400_000 / chartDays) * 100);
  const width = Math.max(4, ((Math.abs(end - start) / 86_400_000 + 1) / chartDays) * 100);
  return { left, width: Math.min(100 - left, width) };
}

function TaskList({ tasks, projectsById, onToggle, onDelete, onUpdate, empty, compact = false, expandedMap, setExpandedMap, allowCompactEdit = false }: {
  tasks: Task[];
  projectsById?: Map<string, Project>;
  onToggle?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onUpdate?: (event: FormEvent<HTMLFormElement>, id: string) => void;
  empty: string;
  compact?: boolean;
  expandedMap?: Record<string, boolean>;
  setExpandedMap?: Dispatch<SetStateAction<Record<string, boolean>>>;
  allowCompactEdit?: boolean;
}) {
  if (tasks.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div className="taskList">
      {tasks.map((task) => (
        <article className={`card ${task.status === 'done' ? 'done' : ''}`} key={task.id}>
          <div className="cardHead">
            <label className="check">{onToggle && <input type="checkbox" checked={task.status === 'done'} onChange={() => onToggle(task)} />}<span>{task.title}</span></label>
            <div className="cardActions">
              {setExpandedMap && <button type="button" className="iconButton" title={(expandedMap?.[task.id] ?? false) ? 'Hide details' : 'Show details'} aria-label={(expandedMap?.[task.id] ?? false) ? `Hide ${task.title} details` : `Show ${task.title} details`} onClick={() => setExpandedMap((current) => ({ ...current, [task.id]: !(expandedMap?.[task.id] ?? false) }))}>{(expandedMap?.[task.id] ?? false) ? '▴' : '▾'}</button>}
              {onDelete && <button type="button" className="iconButton" title="Delete" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}>🗑</button>}
            </div>
          </div>
          <div className="compactStack">
            <p><StatusBadge status={task.status} /> {task.dueAt && <span className="due">Due {new Date(task.dueAt).toLocaleString()}</span>} {task.projectId && projectsById?.get(task.projectId) ? <span className="due"> · {projectsById.get(task.projectId)?.name}</span> : null}</p>
            <Meta tags={task.tags} />
          </div>
          {(!compact || allowCompactEdit) && (expandedMap?.[task.id] ?? false) && onUpdate ? <div className="editSection"><TaskForm title="Edit task" task={task} projects={[...(projectsById?.values() ?? [])]} onSubmit={(event) => onUpdate(event, task.id)} onCancel={() => setExpandedMap?.((current) => ({ ...current, [task.id]: false }))} /></div> : null}
        </article>
      ))}
    </div>
  );
}

function CaptureList({ captures, convertCapture, deleteCapture }: { captures: QuickCapture[]; convertCapture: (capture: QuickCapture, target: PrefillTarget) => void; deleteCapture: (capture: QuickCapture) => void }) {
  if (captures.length === 0) return <p className="empty">No quick captures yet.</p>;
  return (
    <div className="captureList">
      {captures.map((capture) => (
        <article className="miniCard" key={capture.id}>
          <p className="preline">{capture.text}</p>
          <time>{formatActivityTime(capture.createdAt)}</time>
          <Meta tags={capture.tags} />
          <div className="cardActions">
            <button type="button" onClick={() => convertCapture(capture, 'knowledge')}>Knowledge</button>
            <button type="button" onClick={() => convertCapture(capture, 'questions')}>Question</button>
            <button type="button" onClick={() => convertCapture(capture, 'troubleshooting')}>Troubleshooting</button>
            <button type="button" onClick={() => deleteCapture(capture)}>Delete</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ActivityList({ activities, expanded, onToggleExpanded }: { activities: Activity[]; expanded: boolean; onToggleExpanded: () => void }) {
  if (activities.length === 0) return <p className="empty">No activity yet.</p>;
  return (
    <>
      <ol className="activity">
        {(expanded ? activities : activities.slice(0, 3)).map((activity) => <li key={activity.id}><span>{activity.message}</span><time>{formatActivityTime(activity.createdAt)}</time></li>)}
      </ol>
      {activities.length > 3 ? <button type="button" onClick={onToggleExpanded}>{expanded ? 'Show less' : 'Show more'}</button> : null}
    </>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>;
}

function Meta({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return <p className="meta">{tags.map((tag) => <span key={tag}>#{tag}</span>)}</p>;
}

function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge ${status}`}>{status.replace('-', ' ')}</span>;
}

function formatActivityTime(createdAt: string) {
  const date = new Date(createdAt);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `[${day} ${month} ${hours}:${minutes}]`;
}

function weeklyContribution(log: WeeklyLog) {
  return [log.solved, log.impact].filter(Boolean).join('\n');
}

function systemSummary(system?: SystemEntry) {
  if (!system) return '';
  return [system.workflow, system.inputs, system.outputs, system.databases].filter(Boolean).join('\n');
}

function troubleshootingObserved(entry?: TroubleshootingEntry) {
  if (!entry) return '';
  return [entry.symptoms, entry.error, entry.hypothesis, entry.investigation].filter(Boolean).join('\n');
}

function troubleshootingFix(entry?: TroubleshootingEntry) {
  if (!entry) return '';
  return [entry.solution, entry.prevention].filter(Boolean).join('\n');
}

function systemFromForm(form: FormData, now: string): Omit<SystemEntry, 'id'> {
  return {
    name: String(form.get('name') || '').trim(),
    purpose: String(form.get('purpose') || '').trim(),
    owner: String(form.get('owner') || '').trim(),
    users: '',
    inputs: '',
    outputs: '',
    workflow: String(form.get('workflow') || '').trim(),
    repositories: '',
    databases: '',
    infrastructure: '',
    dependencies: '',
    commonFailures: String(form.get('commonFailures') || '').trim(),
    debuggingNotes: '',
    relatedKnowledge: '',
    relatedTroubleshooting: '',
    tags: [],
    createdAt: now,
    updatedAt: now
  };
}

function troubleshootingFromForm(form: FormData, now: string): Omit<TroubleshootingEntry, 'id'> {
  return {
    title: String(form.get('title') || '').trim(),
    symptoms: String(form.get('symptoms') || '').trim(),
    error: '',
    hypothesis: '',
    investigation: '',
    rootCause: String(form.get('rootCause') || '').trim(),
    solution: String(form.get('solution') || '').trim(),
    prevention: '',
    relatedSystem: String(form.get('relatedSystem') || '').trim(),
    tags: parseTags(String(form.get('tags') || '')),
    dateResolved: String(form.get('dateResolved') || ''),
    createdAt: now,
    updatedAt: now
  };
}

function glossaryFromForm(form: FormData, now: string): Omit<GlossaryEntry, 'id'> {
  return {
    term: String(form.get('term') || '').trim(),
    meaning: String(form.get('meaning') || '').trim(),
    context: String(form.get('context') || '').trim(),
    createdAt: now,
    updatedAt: now
  };
}

function mergeImportedData(current: DayBookData, imported: Partial<DayBookData>): DayBookData {
  return {
    tasks: mergeById(current.tasks, imported.tasks),
    notes: mergeById(current.notes, imported.notes),
    projects: mergeById(current.projects, imported.projects),
    activities: [...(imported.activities ?? []), ...current.activities].slice(0, 30),
    weeklyLogs: mergeById(current.weeklyLogs, imported.weeklyLogs),
    systems: mergeById(current.systems, imported.systems),
    troubleshooting: mergeById(current.troubleshooting, imported.troubleshooting),
    questions: mergeById(current.questions, imported.questions),
    captures: mergeById(current.captures, imported.captures),
    glossary: mergeById(current.glossary, imported.glossary),
    scratchpadItems: mergeById(current.scratchpadItems, imported.scratchpadItems),
    settings: imported.settings ? { ...current.settings, ...imported.settings } : current.settings
  };
}

function mergeById<T extends { id: string }>(existing: T[], incoming?: T[]) {
  const map = new Map(existing.map((item) => [item.id, item]));
  incoming?.forEach((item) => map.set(item.id, item));
  return [...map.values()];
}

function notifyDueTasks(tasks: Task[], notified: Set<string>, flashMessage: (value: string) => void) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  tasks
    .filter((task) => task.status !== 'done' && task.reminderAt && !notified.has(task.id))
    .filter((task) => new Date(task.reminderAt).getTime() <= now)
    .forEach((task) => {
      notified.add(task.id);
      new Notification('DayBook reminder', { body: task.title });
      flashMessage(`Reminder sent: ${task.title}`);
    });
}

function notifyMissingWeeklyLog(weeklyLogs: WeeklyLog[], notified: Set<string>, flashMessage: (value: string) => void) {
  const weekStart = weeklyLogReminderWeek(weeklyLogs, new Date(), notified);
  if (!weekStart) return;
  notified.add(weekStart);
  const message = `No weekly log saved for week of ${weekStart}.`;
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('DayBook weekly log', { body: message });
  }
  flashMessage(message);
}

async function writeBackup(handle: BackupFileHandle, data: DayBookData, setBackupStatus: (value: string) => void) {
  try {
    if (handle.queryPermission && await handle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      setBackupStatus('Auto backup needs file permission again. Choose the backup file in Settings.');
      return;
    }
    const writable = await handle.createWritable();
    await writable.write(backupBlob(data));
    await writable.close();
    setBackupStatus(`Auto backup saved at ${new Date().toLocaleTimeString()}.`);
  } catch {
    setBackupStatus('Auto backup failed. Use Export JSON, then choose the backup file again.');
  }
}

export function msUntilNextBackup(now = new Date()) {
  const next = new Date(now);
  next.setHours(12, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function filterList<T>(items: T[], query: string, text: (item: T) => string[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((item) => text(item).join(' ').toLowerCase().includes(needle));
}

export function searchData(data: DayBookData, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const matches = (values: string[]) => values.join(' ').toLowerCase().includes(needle);
  return [
    ...data.tasks.filter((task) => matches([task.title, task.notes, task.status, task.dueAt, task.roadblock, task.tags.join(' ')])).map((task) => ({ type: 'Task', id: task.id, title: task.title, detail: task.notes || task.roadblock || task.status, tags: task.tags })),
    ...data.notes.filter((note) => matches([note.title, note.body, note.tags.join(' ')])).map((note) => ({ type: 'Knowledge', id: note.id, title: note.title, detail: note.body.slice(0, 160), tags: note.tags })),
    ...data.glossary.filter((entry) => matches([entry.term, entry.meaning, entry.context])).map((entry) => ({ type: 'Glossary', id: entry.id, title: entry.term, detail: entry.meaning, tags: [] })),
    ...data.scratchpadItems.filter((item) => matches([item.title, item.context, item.notes, item.done ? 'done' : 'open'])).map((item) => ({ type: 'Scratchpad', id: item.id, title: item.title, detail: item.context || item.notes || (item.done ? 'Done' : 'Open'), tags: [] })),
    ...data.weeklyLogs.filter((log) => matches([log.weekStart, log.learned, log.workedOn, log.blockers, weeklyContribution(log), log.nextWeek])).map((log) => ({ type: 'Weekly Log', id: log.id, title: `Week of ${log.weekStart}`, detail: compactLog(log).slice(0, 160), tags: [] })),
    ...data.systems.filter((system) => matches([system.name, system.purpose, systemSummary(system), system.commonFailures])).map((system) => ({ type: 'System', id: system.id, title: system.name, detail: system.purpose, tags: [] })),
    ...data.troubleshooting.filter((entry) => matches([entry.title, entry.symptoms, entry.error, entry.rootCause, entry.solution, entry.relatedSystem, entry.tags.join(' ')])).map((entry) => ({ type: 'Troubleshooting', id: entry.id, title: entry.title, detail: entry.solution || entry.rootCause || entry.symptoms, tags: entry.tags })),
    ...data.questions.filter((question) => matches([question.question, question.status, question.relatedSystem, question.notes])).map((question) => ({ type: 'Question', id: question.id, title: question.question, detail: question.notes || question.status, tags: [] })),
    ...data.captures.filter((capture) => matches([capture.text, capture.tags.join(' ')])).map((capture) => ({ type: 'Quick Capture', id: capture.id, title: capture.text.slice(0, 80), detail: formatActivityTime(capture.createdAt), tags: capture.tags }))
  ];
}

export function taskMonth(task: Task) {
  return task.updatedAt.slice(0, 7);
}

export function listTaskMonths(tasks: Task[]) {
  return [...new Set(tasks.map(taskMonth).filter(Boolean))].sort((left, right) => right.localeCompare(left));
}

function sortTasksByDue(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export function localDataSummary(data: DayBookData) {
  const counts: [string, number][] = [
    ['task', data.tasks.length],
    ['knowledge note', data.notes.length],
    ['glossary term', data.glossary.length],
    ['weekly log', data.weeklyLogs.length],
    ['system', data.systems.length],
    ['troubleshooting entry', data.troubleshooting.length],
    ['question', data.questions.length],
    ['quick capture', data.captures.length],
    ['scratchpad item', data.scratchpadItems.length]
  ];
  return counts.filter(([, count]) => count).map(([label, count]) => `${count} ${label}${count === 1 ? '' : 's'}`).join(', ');
}

export function formatWeekRange(start: Date, end: Date) {
  const dayMonth = { day: 'numeric', month: 'short' } as const;
  const withYear = { ...dayMonth, year: 'numeric' } as const;
  return `${start.toLocaleDateString('en-GB', dayMonth)} - ${end.toLocaleDateString('en-GB', withYear)}`;
}

export function glossaryTitle(entry: GlossaryEntry) {
  return `${entry.term} : ${entry.meaning}`;
}

export function questionPreview(question: QuestionEntry) {
  return question.notes || 'No answer yet';
}

export function groupGlossary(glossary: GlossaryEntry[]): [string, GlossaryEntry[]][] {
  const sorted = [...glossary].sort((left, right) => left.term.localeCompare(right.term));
  const groups = new Map<string, GlossaryEntry[]>();
  sorted.forEach((entry) => {
    const letter = (entry.term.trim()[0] || '#').toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });
  return [...groups.entries()];
}

export function weeklyLogTitle(log: Pick<WeeklyLog, 'weekStart'>) {
  const start = new Date(`${log.weekStart}T12:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  return `Week of ${formatDateInput(start)} to ${formatDateInput(end)}`;
}

export function listWeeklyLogMonths(logs: WeeklyLog[]) {
  return [...new Set(logs.map((log) => log.weekStart.slice(0, 7)).filter(Boolean))].sort((left, right) => right.localeCompare(left));
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function compactLog(log: WeeklyLog) {
  return weeklyLogSections(log).map(([label, value]) => `${label}\n${value}`).join('\n\n');
}

function weeklyLogSections(log: WeeklyLog): [string, string][] {
  return [
    ['Learned', log.learned],
    ['Worked on', log.workedOn],
    ['Problems / blockers', log.blockers],
    ['Problems solved / contribution', weeklyContribution(log)],
    ['Open questions', log.openQuestions],
    ['Next week priorities', log.nextWeek]
  ].filter((section): section is [string, string] => Boolean(section[1]));
}
