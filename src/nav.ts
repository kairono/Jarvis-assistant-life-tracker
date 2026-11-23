// App navigation model. The assistant is a slide-over panel, not a view here.
export type ViewId =
  | 'dashboard'
  | 'finances'
  | 'training'
  | 'goals'
  | 'tasks'
  | 'tracker'
  | 'memory'
  | 'settings';

export interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
  /** visionOS-style app-icon gradient: [top-left, bottom-right]. */
  colors: [string, string];
}

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Command', icon: 'grid', colors: ['#64D2FF', '#0A84FF'] },
  { id: 'finances', label: 'Finances', icon: 'wallet', colors: ['#4CD964', '#1F9E5A'] },
  { id: 'training', label: 'Training', icon: 'activity', colors: ['#FFB340', '#FF453A'] },
  { id: 'goals', label: 'Goals', icon: 'target', colors: ['#FF6482', '#E5175C'] },
  { id: 'tasks', label: 'Tasks', icon: 'check', colors: ['#FFE14D', '#FF9F0A'] },
  { id: 'tracker', label: 'Tracker', icon: 'clock', colors: ['#7D7AFF', '#3634A3'] },
  { id: 'memory', label: 'Memory', icon: 'brain', colors: ['#DA8FFF', '#9B3FD9'] },
  { id: 'settings', label: 'Settings', icon: 'settings', colors: ['#AEAEB2', '#5C5C63'] },
];

export const VIEW_TITLES: Record<ViewId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Command Center', subtitle: 'Everything, at a glance' },
  finances: { title: 'Finances', subtitle: 'Income, spending & trends' },
  training: { title: 'Training', subtitle: 'Workouts & progress' },
  goals: { title: 'Goals', subtitle: 'Targets & milestones' },
  tasks: { title: 'Tasks', subtitle: 'What needs doing' },
  tracker: { title: 'Activity Tracker', subtitle: 'Where your time goes' },
  memory: { title: 'Memory', subtitle: 'What Claude knows about you' },
  settings: { title: 'Settings', subtitle: 'Personalize your assistant' },
};
