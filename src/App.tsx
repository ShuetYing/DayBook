import { Dispatch, FormEvent, ReactNode, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { buildWeeklySummary, formatDateInput, parseTags } from './summary';
import { loadData, saveData } from './storage';
import type { Activity, AppSettings, DayBookData, Note, Project, Task, TaskStatus, WeeklySummary } from './types';

type Page = 'dashboard' | 'tasks' | 'projects' | 'knowledge' | 'weekly' | 'settings';
type ProjectTab = 'overview' | 'subtasks' | 'timeline';

const emptyData: DayBookData = { tasks: [], notes: [], projects: [], activities: [], weeklySummaries: [], settings: { theme: 'mint' } };
// Keep the default note body in one place so future tweaks only touch this string.
const standardNoteTemplate = 'What I learned\n\nWhy it matters\n\nExample / command\n\nNext step\n';
const presetTags = ['Analysis', 'Tech stack', 'Troubleshooting', 'Other'];
const navItems: { page: Page; label: string }[] = [
  { page: 'dashboard', label: 'Dashboard' },
  { page: 'tasks', label: 'Tasks' },
  { page: 'projects', label: 'Projects' },
  { page: 'knowledge', label: 'Knowledge Repo' },
  { page: 'weekly', label: 'Weekly Summary' },
  { page: 'settings', label: 'Settings' }
];
export default function App() {
  const [data, setData] = useState<DayBookData>(emptyData);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [message, setMessage] = useState('');
  const [noteQuery, setNoteQuery] = useState('');
  const [weekDate, setWeekDate] = useState(formatDateInput(new Date()));
  const [projectTabs, setProjectTabs] = useState<Record<string, ProjectTab>>({});
  const [expandedActivity, setExpandedActivity] = useState(false);
  const [expandedDashboardTasks, setExpandedDashboardTasks] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const notified = useRef(new Set<string>());
  const messageTimer = useRef<number | null>(null);

  useEffect(() => {
    loadData().then(setData).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) saveData(data);
  }, [data, ready]);

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);

  useEffect(() => {
    const timer = window.setInterval(() => notifyDueTasks(data.tasks, notified.current, flashMessage), 60_000);
    notifyDueTasks(data.tasks, notified.current, flashMessage);
    return () => window.clearInterval(timer);
  }, [data.tasks]);

  const today = formatDateInput(new Date());
  const selectedSummary = useMemo(() => buildWeeklySummary(data.tasks, data.notes, new Date(`${weekDate}T12:00:00`)), [data.tasks, data.notes, weekDate]);
  const todayDate = new Date();
  const todayLabel = todayDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const currentPage = navItems.find((item) => item.page === page);
  const projectsById = new Map(data.projects.map((project) => [project.id, project]));

  function updateData(change: (current: DayBookData, now: string) => DayBookData) {
    const now = new Date().toISOString();
    setData((current) => change(current, now));
  }

  function flashMessage(text: string) {
    setMessage(text);
    if (messageTimer.current != null) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(''), 1800);
  }

  useEffect(() => () => {
    if (messageTimer.current != null) window.clearTimeout(messageTimer.current);
  }, []);

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
    setExpandedTasks((current) => ({ ...current, draft: false }));
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
    setExpandedTasks((current) => {
      const copy = { ...current };
      delete copy[task.id];
      return copy;
    });
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
        progress: String(form.get('progress') || '').trim(),
        timeline: String(form.get('timeline') || '').trim(),
        category: '',
        tags: [],
        createdAt: now,
        updatedAt: now
      }, ...current.projects],
      activities: withActivity(current, `Created project: ${name}`, now)
    }));
    flashMessage(`Project created: ${name}`);
    setExpandedProjects((current) => ({ ...current, draft: false }));
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
        progress: String(form.get('progress') || '').trim(),
        timeline: String(form.get('timeline') || '').trim(),
        updatedAt: now
      } : project),
      activities: withActivity(current, `Updated project: ${name}`, now)
    }));
    flashMessage(`Project updated: ${name}`);
    setExpandedProjects((current) => ({ ...current, [id]: false }));
  }

  function deleteProject(project: Project) {
    updateData((current, now) => ({
      ...current,
      projects: current.projects.filter((item) => item.id !== project.id),
      tasks: current.tasks.map((task) => task.projectId === project.id ? { ...task, projectId: '', updatedAt: now } : task),
      activities: withActivity(current, `Deleted project: ${project.name}`, now)
    }));
    flashMessage(`Project deleted: ${project.name}`);
    setExpandedProjects((current) => {
      const copy = { ...current };
      delete copy[project.id];
      return copy;
    });
  }

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = String(form.get('body') || '').trim();
    if (!body) return;
    const title = String(form.get('title') || '').trim() || 'Untitled note';

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
      activities: withActivity(current, `Created note: ${title}`, now)
    }));
    flashMessage(`Note created: ${title}`);
    event.currentTarget.reset();
  }

  function deleteNote(note: Note) {
    updateData((current, now) => ({
      ...current,
      notes: current.notes.filter((item) => item.id !== note.id),
      activities: withActivity(current, `Deleted note: ${note.title}`, now)
    }));
    flashMessage(`Note deleted: ${note.title}`);
  }

  function saveWeeklySummary(summary: WeeklySummary) {
    updateData((current, now) => ({
      ...current,
      weeklySummaries: [summary, ...current.weeklySummaries.filter((item) => item.id !== summary.id)],
      activities: withActivity(current, `Saved weekly summary: ${summary.weekStart} to ${summary.weekEnd}`, now)
    }));
    flashMessage(`Saved weekly log: ${summary.weekStart} to ${summary.weekEnd}`);
  }

  function deleteWeeklySummary(summary: WeeklySummary) {
    updateData((current, now) => ({
      ...current,
      weeklySummaries: current.weeklySummaries.filter((item) => item.id !== summary.id),
      activities: withActivity(current, `Deleted weekly summary: ${summary.weekStart} to ${summary.weekEnd}`, now)
    }));
    flashMessage(`Deleted weekly log: ${summary.weekStart} to ${summary.weekEnd}`);
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
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daybook-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<DayBookData>;
      setData((current) => mergeImportedData(current, parsed));
      flashMessage('Imported JSON data.');
    } catch {
      flashMessage('Import failed. Pick a valid DayBook JSON file.');
    }
  }

  function clearAllData() {
    setData(emptyData);
    setExpandedTasks({});
    setExpandedProjects({});
    setExpandedActivity(false);
    notified.current.clear();
    flashMessage('All local DayBook data removed.');
  }

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Main features">
        <div>
          <h1>DayBook</h1>
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
          <div className={page === 'dashboard' ? 'no-margin' : ''}>
            <h1>{currentPage?.label}</h1>
            {page === 'dashboard' ? <p className="pageSubhead">{todayLabel}</p> : null}
          </div>
        </header>

        <div className={`notice ${message ? 'show' : ''}`} aria-live="polite">{message}</div>

        {page === 'dashboard' && (
          <Dashboard 
            data={data} 
            today={today} 
            todayLabel={todayLabel} 
            projectsById={projectsById} 
            setPage={setPage}
            expandedDashboardTasks={expandedDashboardTasks}
            setExpandedDashboardTasks={setExpandedDashboardTasks}
            expandedActivity={expandedActivity}
            setExpandedActivity={setExpandedActivity}
          />
        )}
        {page === 'tasks' && (
          <TasksPage
            data={data}
            addTask={addTask}
            updateTask={updateTask}
            toggleTask={toggleTask}
            deleteTask={deleteTask}
            expandedTasks={expandedTasks}
            setExpandedTasks={setExpandedTasks}
          />
        )}
        {page === 'projects' && (
          <ProjectsPage
            data={data}
            projectTabs={projectTabs}
            setProjectTabs={setProjectTabs}
            addProject={addProject}
            updateProject={updateProject}
            deleteProject={deleteProject}
            expandedProjects={expandedProjects}
            setExpandedProjects={setExpandedProjects}
          />
        )}
        {page === 'knowledge' && (
          <KnowledgePage
            notes={data.notes}
            noteQuery={noteQuery}
            setNoteQuery={setNoteQuery}
            addNote={addNote}
            deleteNote={deleteNote}
          />
        )}
        {page === 'weekly' && (
          <WeeklyPage
            summary={selectedSummary}
            weekDate={weekDate}
            setWeekDate={setWeekDate}
            saved={data.weeklySummaries}
            tasks={data.tasks}
            notes={data.notes}
            saveWeeklySummary={saveWeeklySummary}
            deleteWeeklySummary={deleteWeeklySummary}
          />
        )}
        {page === 'settings' && <SettingsPage data={data} exportJson={exportJson} importJson={importJson} enableNotifications={enableNotifications} settings={data.settings} updateSettings={(settings) => setData((current) => ({ ...current, settings }))} clearAllData={clearAllData} />}
      </main>
    </div>
  );
}

function Dashboard({ data, today, todayLabel, projectsById, setPage, expandedDashboardTasks, setExpandedDashboardTasks, expandedActivity, setExpandedActivity }: {
  data: DayBookData;
  today: string;
  todayLabel: string;
  projectsById: Map<string, Project>;
  setPage: (page: Page) => void;
  expandedDashboardTasks: boolean;
  setExpandedDashboardTasks: Dispatch<SetStateAction<boolean>>;
  expandedActivity: boolean;
  setExpandedActivity: Dispatch<SetStateAction<boolean>>;
}) {
  const now = Date.now();
  const openTasks = data.tasks.filter((task) => task.status !== 'done');
  const todayTasks = openTasks.filter((task) => task.dueAt.slice(0, 10) === today);
  const expiredTasks = openTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < now);
  const reminders = openTasks.filter((task) => task.reminderAt);
  const inProgress = data.tasks.filter((task) => task.status === 'in-progress');
  const completed = data.tasks.filter((task) => task.status === 'done');
  const dashboardStats = [
    { key: 'in-progress', label: 'In progress', count: inProgress.length, emoji: '🛠️', onClick: () => setPage('tasks') },
    { key: 'today', label: 'Today', count: todayTasks.length, emoji: '📅', onClick: () => setPage('tasks') },
    { key: 'expired', label: 'Expired', count: expiredTasks.length, emoji: '⏰', onClick: () => setPage('tasks') },
    { key: 'reminders', label: 'Reminders', count: reminders.length, emoji: '🔔', onClick: () => setPage('tasks') },
    { key: 'completed', label: 'Completed', count: completed.length, emoji: '✅', onClick: () => setPage('weekly') }
  ];
  const recentTasks = [...data.tasks]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return (
    <>
      <section className="summary dashboardSummary" aria-label="Weekly summary">
        <div className="stats">
          {dashboardStats.map((item) => (
            <button className="statButton" type="button" key={item.key} onClick={item.onClick}>
              <strong className={`statCard ${item.key}`}>
                <span className="statLabel">{item.label}</span>
                <span className="statValueRow">
                  <span className="statValue">{item.count}</span>
                  <span className="statEmoji" aria-hidden="true">{item.emoji}</span>
                </span>
                <span className="statMeta">{item.key === 'completed' ? `${item.count} done` : `${item.count} tasks`}</span>
              </strong>
            </button>
          ))}
        </div>
      </section>

      <section className="dashboardGrid">
        <Panel title="Task overview">
          <TaskList tasks={expandedDashboardTasks ? recentTasks : recentTasks.slice(0, 3)} projectsById={projectsById} empty="No tasks yet." compact />
          {recentTasks.length > 3 ? (
            <button style={{ marginTop: '16px' }} type="button" onClick={() => setExpandedDashboardTasks((value) => !value)}>
              {expandedDashboardTasks ? 'Show less' : 'Show more'}
            </button>
          ) : null}
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
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (data.tasks.length === 0) {
      setShowCreate(true);
    }
  }, [data.tasks.length]);

  return (
    <section className="stack">
      <div className="pageActions">
        <div />
        <button type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Hide new task' : 'Create new task'}</button>
      </div>
      {showCreate ? <TaskForm title="Add task" onSubmit={(event) => { addTask(event); setShowCreate(false); }} projects={data.projects} onCancel={() => setShowCreate(false)} /> : null}
      <div>
        <TaskList tasks={data.tasks} projectsById={projectsById} onToggle={toggleTask} onDelete={deleteTask} onUpdate={updateTask} empty="No tasks yet." expandedMap={expandedTasks} setExpandedMap={setExpandedTasks} />
      </div>
    </section>
  );
}

function ProjectsPage({ data, projectTabs, setProjectTabs, addProject, updateProject, deleteProject, expandedProjects, setExpandedProjects }: {
  data: DayBookData;
  projectTabs: Record<string, ProjectTab>;
  setProjectTabs: (tabs: Record<string, ProjectTab>) => void;
  addProject: (event: FormEvent<HTMLFormElement>) => void;
  updateProject: (event: FormEvent<HTMLFormElement>, id: string) => void;
  deleteProject: (project: Project) => void;
  expandedProjects: Record<string, boolean>;
  setExpandedProjects: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (data.projects.length === 0) {
      setShowCreate(true);
    }
  }, [data.projects.length]);

  return (
    <section className="stack">
      <div className="pageActions">
        <div />
        <button type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Hide new project' : 'Create new project'}</button>
      </div>
      {showCreate ? <ProjectForm title="New project" onSubmit={(event) => { addProject(event); setShowCreate(false); }} onCancel={() => setShowCreate(false)} /> : null}
      <div className="taskList">
        {data.projects.length === 0 ? <p className="empty">No projects yet.</p> : data.projects.map((project) => {
          const tab = projectTabs[project.id] ?? 'overview';
          const subtasks = data.tasks.filter((task) => task.projectId === project.id);
          const dueDate = getProjectDueDate(project.timeline);
          const expanded = expandedProjects[project.id] ?? false;
          return (
            <article className="card" key={project.id}>
              <div className="cardHead">
                <h3>{project.name}</h3>
                <div className="cardActions">
                  <button type="button" onClick={() => setExpandedProjects((current) => ({ ...current, [project.id]: !expanded }))}>
                    {expanded ? 'Hide' : 'Details'}
                  </button>
                  <button type="button" onClick={() => deleteProject(project)}>Delete</button>
                </div>
              </div>
              {!expanded ? (
                <div className="compactStack">
                  <p className="due">{dueDate ? `Due ${dueDate}` : 'No due date yet.'}</p>
                </div>
              ) : (
                <>
                  <div className="tabs">
                    {(['overview', 'subtasks', 'timeline'] as ProjectTab[]).map((item) => (
                      <button className={tab === item ? 'active' : ''} type="button" key={item} onClick={() => setProjectTabs({ ...projectTabs, [project.id]: item })}>
                        {item === 'subtasks' ? 'Sub-tasks' : item}
                      </button>
                    ))}
                  </div>
                  {tab === 'overview' && (
                    <>
                      <p>{project.overview || 'No overview yet.'}</p>
                      <p>{project.details || 'No details yet.'}</p>
                      <p className="roadblock">{dueDate ? `Due ${dueDate}` : 'No due date yet.'}</p>
                      <Meta tags={project.tags} />
                    </>
                  )}
                  {tab === 'subtasks' && <TaskList tasks={subtasks} empty="No tasks linked to this project yet." compact />}
                  {tab === 'timeline' && <ProjectTimeline timeline={project.timeline} />}
                  <details>
                    <summary>Edit project</summary>
                    <ProjectForm title="Edit project" project={project} onSubmit={(event) => updateProject(event, project.id)} onCancel={() => setExpandedProjects((current) => ({ ...current, [project.id]: false }))} />
                  </details>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function KnowledgePage({ notes, noteQuery, setNoteQuery, addNote, deleteNote }: {
  notes: Note[];
  noteQuery: string;
  setNoteQuery: (query: string) => void;
  addNote: (event: FormEvent<HTMLFormElement>) => void;
  deleteNote: (note: Note) => void;
}) {
  const query = noteQuery.toLowerCase();
  const visibleNotes = notes.filter((note) => [note.title, note.body, note.tags.join(' ')].join(' ').toLowerCase().includes(query));

  return (
    <section className="grid">
      <form className="panel" onSubmit={addNote}>
        <h2>Add learning note</h2>
        <label>Title<input name="title" placeholder="Partition pruning" /></label>
        <label>Tags<input name="tags" list="note-tags" placeholder="Analysis, sql" /></label>
        <label>Note<textarea name="body" rows={10} required defaultValue={standardNoteTemplate} /></label>
        <button type="submit">Save note</button>
      </form>

      <div>
        <label className="search">Search notes<input value={noteQuery} onChange={(event) => setNoteQuery(event.target.value)} placeholder="sql, bug, airflow..." /></label>
        <datalist id="note-tags">
          {presetTags.map((tag) => <option key={tag} value={tag} />)}
          {[...new Set(notes.flatMap((note) => note.tags))].map((tag) => <option key={tag} value={tag} />)}
        </datalist>
        <div className="notes">
          {visibleNotes.length === 0 ? null : visibleNotes.map((note) => (
            <article className="card" key={note.id}>
              <div className="cardHead">
                <h3>{note.title}</h3>
                <button type="button" onClick={() => deleteNote(note)} aria-label={`Delete ${note.title}`}>Delete</button>
              </div>
              <p className="preline">{note.body}</p>
              <Meta tags={note.tags} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function WeeklyPage({ summary, weekDate, setWeekDate, saved, tasks, notes, saveWeeklySummary, deleteWeeklySummary }: {
  summary: WeeklySummary;
  weekDate: string;
  setWeekDate: (value: string) => void;
  saved: WeeklySummary[];
  tasks: Task[];
  notes: Note[];
  saveWeeklySummary: (summary: WeeklySummary) => void;
  deleteWeeklySummary: (summary: WeeklySummary) => void;
}) {
  const weekTasks = tasks.filter((task) => task.updatedAt.slice(0, 10) >= summary.weekStart && task.updatedAt.slice(0, 10) <= summary.weekEnd);
  const weekNotes = notes.filter((note) => note.updatedAt.slice(0, 10) >= summary.weekStart && note.updatedAt.slice(0, 10) <= summary.weekEnd);

  return (
    <section className="stack">
      <div className="panel rowPanel">
        <label>Pick week by date<input type="date" value={weekDate} onChange={(event) => setWeekDate(event.target.value)} /></label>
        <button type="button" onClick={() => saveWeeklySummary(summary)}>Save week log</button>
      </div>
      <section className="summary weeklyCards">
        <div className="weeklyCard green">
          <div className="weeklyIcon">✅</div>
          <strong>{summary.taskStats.completed}</strong>
          <span>Completed</span>
        </div>
        <div className="weeklyCard amber">
          <div className="weeklyIcon">🛠️</div>
          <strong>{summary.taskStats.inProgress}</strong>
          <span>In progress</span>
        </div>
        <div className="weeklyCard red">
          <div className="weeklyIcon">⏰</div>
          <strong>{summary.taskStats.incomplete}</strong>
          <span>Incomplete</span>
        </div>
        <div className="weeklyCard blue">
          <div className="weeklyIcon">↪</div>
          <strong>{summary.taskStats.carriedForward}</strong>
          <span>Carried over</span>
        </div>
      </section>
      <div className="columns">
        <Panel title="Task details">
          <TaskList tasks={weekTasks} empty="No task changes recorded in this week." compact />
        </Panel>
        <Panel title="Knowledge captured">
          {weekNotes.length === 0 ? null : weekNotes.map((note) => <p key={note.id}>{note.title}</p>)}
        </Panel>
      </div>
      <Panel title="Saved logs">
        {saved.length === 0 ? <p className="empty">No saved weekly logs yet.</p> : saved.map((item) => (
          <article className="miniCard" key={item.id}>
            <div className="cardHead">
              <strong>{item.weekStart} to {item.weekEnd}</strong>
              <button type="button" onClick={() => deleteWeeklySummary(item)}>Delete</button>
            </div>
            <p>{item.generatedText}</p>
            <p className="metaLine">
              {item.taskStats.completed} completed, {item.taskStats.inProgress} in progress, {item.taskStats.incomplete} incomplete, {item.taskStats.carriedForward} carried over
            </p>
            {item.noteHighlights.length > 0 ? (
              <p className="metaLine">Learning: {item.noteHighlights.join(' · ')}</p>
            ) : null}
          </article>
        ))}
      </Panel>
    </section>
  );
}

function SettingsPage({ data, exportJson, importJson, enableNotifications, settings, updateSettings, clearAllData }: {
  data: DayBookData;
  exportJson: () => void;
  importJson: (file: File | undefined) => void;
  enableNotifications: () => Promise<void>;
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => void;
  clearAllData: () => void;
}) {
  return (
    <section className="grid">
      <Panel title="Notifications">
        <p>Allow browser notifications for local reminders while DayBook is open.</p>
        <button type="button" onClick={enableNotifications}>Enable reminders</button>
      </Panel>
      <Panel title="Theme">
        <label>Application theme
          <select value={settings.theme} onChange={(event) => updateSettings({ ...settings, theme: event.target.value as AppSettings['theme'] })}>
            <option value="mint">Mint</option>
            <option value="sage">Sage</option>
            <option value="cream">Cream</option>
          </select>
        </label>
      </Panel>
      <Panel title="Export">
        <p>Download a plain JSON backup for local storage or another device.</p>
        <button type="button" onClick={exportJson}>Export JSON</button>
      </Panel>
      <Panel title="Import">
        <p>Import replaces the current local DayBook data with the selected JSON file.</p>
        <input type="file" accept="application/json" onChange={(event) => importJson(event.target.files?.[0])} />
      </Panel>
      <Panel title="Local data">
        <p>{data.tasks.length} tasks, {data.projects.length} projects, {data.notes.length} notes, {data.weeklySummaries.length} weekly logs.</p>
        <button type="button" className="dangerButton" onClick={clearAllData}>Clear all local data</button>
      </Panel>
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
      {/* Keep task editing fields flat so future task changes stay in one component. */}
      <h2>{title}</h2>
      <label>Title<input name="title" required defaultValue={task?.title} placeholder="Prepare pipeline review" /></label>
      <label>Status
        <select name="status" defaultValue={task?.status ?? 'todo'}>
          <option value="todo">To-do</option>
          <option value="in-progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </label>
      <label>Deadline<input name="dueAt" type="datetime-local" defaultValue={task?.dueAt} /></label>
      <label>Reminder<input name="reminderAt" type="datetime-local" defaultValue={task?.reminderAt} /></label>
      <label>Project
        <select name="projectId" defaultValue={task?.projectId ?? ''}>
          <option value="">No project</option>
          {projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
        </select>
      </label>
      <label>Tags<input name="tags" defaultValue={task?.tags.join(', ')} placeholder="Ad hoc, Research, Feature" /></label>
      <label>Roadblock<input name="roadblock" defaultValue={task?.roadblock} placeholder="Waiting for access" /></label>
      <label>Notes<textarea name="notes" rows={3} defaultValue={task?.notes} placeholder="What needs to happen?" /></label>
      <div className="formActions">
        <button type="submit">{task ? 'Save task' : 'Add task'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function ProjectForm({ title, project, onSubmit, onCancel }: {
  title: string;
  project?: Project;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2>{title}</h2>
      <label>Name<input name="name" required defaultValue={project?.name} placeholder="Warehouse cost review" /></label>
      <label>Overview<textarea name="overview" rows={3} defaultValue={project?.overview} /></label>
      <label>Project details<textarea name="details" rows={4} defaultValue={project?.details} /></label>
      <label>Project stages<textarea name="timeline" rows={4} defaultValue={project?.timeline} placeholder="Stage 1 | 2026-08-13 | Gather requirements" /></label>
      <div className="formActions">
        <button type="submit">{project ? 'Save project' : 'Create project'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function ProjectTimeline({ timeline }: { timeline: string }) {
  const phases = timeline.split('\n').map((item) => item.trim()).filter(Boolean).map((line) => {
    const [name, due, detail] = line.split('|').map((item) => item.trim());
    return { name, due, detail };
  });
  if (phases.length === 0) return <p>No planned timeline yet.</p>;

  return (
    <div className="timeline">
      {phases.map((phase, index) => (
        <div className="timelineRow" key={`${phase.name}-${index}`}>
          <span className="timelineLabel">{phase.name}{phase.due ? ` · ${phase.due}` : ''}</span>
          <div className="timelineBar" style={{ width: `${Math.max(28, Math.min(100, 30 + index * 18))}%` }} />
          {phase.detail ? <span className="timelineDetail">{phase.detail}</span> : null}
        </div>
      ))}
    </div>
  );
}

function TaskList({ tasks, projectsById, onToggle, onDelete, onUpdate, empty, compact = false, expandedMap, setExpandedMap }: {
  tasks: Task[];
  projectsById?: Map<string, Project>;
  onToggle?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onUpdate?: (event: FormEvent<HTMLFormElement>, id: string) => void;
  empty: string;
  compact?: boolean;
  expandedMap?: Record<string, boolean>;
  setExpandedMap?: Dispatch<SetStateAction<Record<string, boolean>>>;
}) {
  if (tasks.length === 0) return <p className="empty">{empty}</p>;

  return (
    <div className="taskList">
      {tasks.map((task) => (
        <article className={`card ${task.status === 'done' ? 'done' : ''}`} key={task.id}>
          <div className="cardHead">
            <label className="check">
              {onToggle && <input type="checkbox" checked={task.status === 'done'} onChange={() => onToggle(task)} />}
              <span>{task.title}</span>
            </label>
            <div className="cardActions">
              {setExpandedMap && (
                <button type="button" onClick={() => setExpandedMap((current) => ({ ...current, [task.id]: !(expandedMap?.[task.id] ?? false) }))}>
                  {(expandedMap?.[task.id] ?? false) ? 'Hide' : 'Details'}
                </button>
              )}
              {onDelete && <button type="button" onClick={() => onDelete(task)} aria-label={`Delete ${task.title}`}>Delete</button>}
            </div>
          </div>
          <div className="compactStack">
            <p><StatusBadge status={task.status} /> {task.dueAt && <span className="due">Due {new Date(task.dueAt).toLocaleString()}</span>}</p>
            <Meta tags={task.tags} />
          </div>
          {(expandedMap?.[task.id] ?? false) && (
            <div className="editSection">
              {onUpdate ? <TaskForm title="Edit task" task={task} projects={[...(projectsById?.values() ?? [])]} onSubmit={(event) => onUpdate(event, task.id)} onCancel={() => setExpandedMap?.((current) => ({ ...current, [task.id]: false }))} /> : null}
            </div>
          )}
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
        {(expanded ? activities : activities.slice(0, 3)).map((activity) => (
          <li key={activity.id}>
            <span>{activity.message}</span>
            <time>{formatActivityTime(activity.createdAt)}</time>
          </li>
        ))}
      </ol>
      {activities.length > 3 ? <button type="button" onClick={onToggleExpanded}>{expanded ? 'Show less' : 'Show more'}</button> : null}
    </>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Meta({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <p className="meta">
      {tags.map((tag) => <span key={tag}>#{tag}</span>)}
    </p>
  );
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

function mergeImportedData(current: DayBookData, imported: Partial<DayBookData>): DayBookData {
  return {
    tasks: mergeById(current.tasks, imported.tasks),
    notes: mergeById(current.notes, imported.notes),
    projects: mergeById(current.projects, imported.projects),
    activities: [...(imported.activities ?? []), ...current.activities].slice(0, 30),
    weeklySummaries: mergeById(current.weeklySummaries, imported.weeklySummaries),
    settings: imported.settings ? { theme: imported.settings.theme ?? current.settings.theme } : current.settings
  };
}

function mergeById<T extends { id: string }>(existing: T[], incoming?: T[]) {
  const map = new Map(existing.map((item) => [item.id, item]));
  incoming?.forEach((item) => map.set(item.id, item));
  return [...map.values()];
}

function getProjectDueDate(timeline: string) {
  const dates = timeline.split('\n')
    .map((line) => line.split('|')[1]?.trim())
    .filter((value): value is string => Boolean(value));
  return dates[0] ?? '';
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
