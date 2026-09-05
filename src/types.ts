export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type QuestionStatus = 'Open' | 'Investigating' | 'Need to ask' | 'Answered';

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

export type WeeklyLog = {
  id: string;
  weekStart: string;
  learned: string;
  workedOn: string;
  blockers: string;
  solved: string;
  impact: string;
  openQuestions: string;
  nextWeek: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type SystemEntry = {
  id: string;
  name: string;
  purpose: string;
  owner: string;
  users: string;
  inputs: string;
  outputs: string;
  workflow: string;
  repositories: string;
  databases: string;
  infrastructure: string;
  dependencies: string;
  commonFailures: string;
  debuggingNotes: string;
  relatedKnowledge: string;
  relatedTroubleshooting: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type TroubleshootingEntry = {
  id: string;
  title: string;
  symptoms: string;
  error: string;
  hypothesis: string;
  investigation: string;
  rootCause: string;
  solution: string;
  prevention: string;
  relatedSystem: string;
  tags: string[];
  dateResolved: string;
  createdAt: string;
  updatedAt: string;
};

export type QuestionEntry = {
  id: string;
  question: string;
  status: QuestionStatus;
  relatedSystem: string;
  relatedKnowledge: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type QuickCapture = {
  id: string;
  text: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type GlossaryEntry = {
  id: string;
  term: string;
  meaning: string;
  context: string;
  createdAt: string;
  updatedAt: string;
};

export type AppSettings = {
  theme: 'mint' | 'sage' | 'cream' | 'sky' | 'rose' | 'graphite';
  density: 'comfortable' | 'compact';
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
  weeklyLogs: WeeklyLog[];
  systems: SystemEntry[];
  troubleshooting: TroubleshootingEntry[];
  questions: QuestionEntry[];
  captures: QuickCapture[];
  glossary: GlossaryEntry[];
  settings: AppSettings;
};
