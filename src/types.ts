export type TaskStatus = 'todo' | 'in-progress' | 'done';

export type Task = {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  dueAt: string;
  reminderAt: string;
  roadblock: string;
  category: string;
  tags: string[];
  projectId: string;
  createdAt: string;
  updatedAt: string;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type WeeklySummary = {
  id: string;
  weekStart: string;
  weekEnd: string;
  generatedText: string;
  taskStats: {
    completed: number;
    incomplete: number;
    inProgress: number;
    carriedForward: number;
  };
  noteHighlights: string[];
  createdAt: string;
};

export type AppSettings = {
  theme: 'mint' | 'sage' | 'cream';
};

export type Project = {
  id: string;
  name: string;
  overview: string;
  details: string;
  progress: string;
  timeline: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type Activity = {
  id: string;
  message: string;
  createdAt: string;
};

export type DayBookData = {
  tasks: Task[];
  notes: Note[];
  projects: Project[];
  activities: Activity[];
  weeklySummaries: WeeklySummary[];
  settings: AppSettings;
};
