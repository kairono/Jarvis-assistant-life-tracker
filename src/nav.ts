// App navigation model. The assistant is a slide-over panel, not a view here.
export type ViewId =
  | 'dashboard'
  | 'finances'
  | 'training'
  | 'goals'
  | 'tasks'
  | 'vision'
  | 'calendar'
  | 'settings';

export interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
}

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Command', icon: 'grid' },
  { id: 'finances', label: 'Finances', icon: 'wallet' },
  { id: 'training', label: 'Training', icon: 'activity' },
  { id: 'goals', label: 'Goals', icon: 'target' },
  { id: 'tasks', label: 'Tasks', icon: 'check' },
  { id: 'vision', label: 'Vision', icon: 'image' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export const VIEW_TITLES: Record<ViewId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Command Center', subtitle: 'Everything, at a glance' },
  finances: { title: 'Finances', subtitle: 'Income, spending & trends' },
  training: { title: 'Training', subtitle: 'Workouts & progress' },
  goals: { title: 'Goals', subtitle: 'Targets & milestones' },
  tasks: { title: 'Tasks', subtitle: 'What needs doing' },
  vision: { title: 'Vision Board', subtitle: 'The life you are building' },
  calendar: { title: 'Calendar', subtitle: 'Upcoming events' },
  settings: { title: 'Settings', subtitle: 'Personalize your assistant' },
};
