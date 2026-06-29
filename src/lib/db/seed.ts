import type {
  Transaction,
  Workout,
  Goal,
  VisionItem,
  Task,
  CalendarEvent,
} from '../../types';

// Dates are generated relative to "now" so the seeded dashboard always looks
// current, no matter when the app is first opened.
const now = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return iso(d);
};
const daysAhead = (n: number) => daysAgo(-n);
const at = (n: number, h: number, m = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const expense = (
  id: string,
  day: number,
  amount: number,
  category: string,
  note?: string,
): Transaction => ({ id, date: daysAgo(day), amount, type: 'expense', category, note });

export const SAMPLE_DATA: {
  transactions: Transaction[];
  workouts: Workout[];
  goals: Goal[];
  visionItems: VisionItem[];
  tasks: Task[];
  calendarEvents: CalendarEvent[];
} = {
  transactions: [
    { id: 't1', date: daysAgo(28), amount: 4200, type: 'income', category: 'Salary', note: 'Monthly pay' },
    { id: 't2', date: daysAgo(0), amount: 4200, type: 'income', category: 'Salary', note: 'Monthly pay' },
    { id: 't3', date: daysAgo(2), amount: 95, type: 'income', category: 'Freelance', note: 'Side gig' },
    expense('t4', 27, 1450, 'Rent', 'Apartment'),
    expense('t5', 1, 1450, 'Rent', 'Apartment'),
    expense('t6', 0, 32, 'Food', 'Groceries'),
    expense('t7', 1, 18, 'Food', 'Lunch'),
    expense('t8', 3, 54, 'Food', 'Dinner out'),
    expense('t9', 5, 41, 'Food', 'Groceries'),
    expense('t10', 8, 22, 'Transport', 'Fuel'),
    expense('t11', 12, 60, 'Transport', 'Transit pass'),
    expense('t12', 4, 15, 'Entertainment', 'Streaming'),
    expense('t13', 9, 48, 'Entertainment', 'Concert'),
    expense('t14', 6, 120, 'Shopping', 'Clothes'),
    expense('t15', 14, 75, 'Health', 'Gym membership'),
    expense('t16', 2, 38, 'Health', 'Supplements'),
    expense('t17', 7, 90, 'Utilities', 'Electricity'),
    expense('t18', 18, 45, 'Utilities', 'Internet'),
    expense('t19', 11, 28, 'Food', 'Coffee runs'),
    expense('t20', 16, 65, 'Shopping', 'Books'),
  ],

  workouts: [
    { id: 'w1', date: daysAgo(0), type: 'Strength', duration: 55, intensity: 4, notes: 'Push day', metrics: { volumeKg: 5200 } },
    { id: 'w2', date: daysAgo(2), type: 'Run', duration: 32, intensity: 3, notes: 'Easy pace', metrics: { distanceKm: 5.2 } },
    { id: 'w3', date: daysAgo(4), type: 'Strength', duration: 60, intensity: 5, notes: 'Pull day', metrics: { volumeKg: 5600 } },
    { id: 'w4', date: daysAgo(6), type: 'Yoga', duration: 40, intensity: 2, notes: 'Mobility' },
    { id: 'w5', date: daysAgo(8), type: 'Run', duration: 45, intensity: 4, metrics: { distanceKm: 8.1 } },
    { id: 'w6', date: daysAgo(11), type: 'Strength', duration: 50, intensity: 4, metrics: { volumeKg: 4900 } },
    { id: 'w7', date: daysAgo(14), type: 'Cycling', duration: 70, intensity: 3, metrics: { distanceKm: 24 } },
    { id: 'w8', date: daysAgo(17), type: 'Run', duration: 28, intensity: 3, metrics: { distanceKm: 4.5 } },
    { id: 'w9', date: daysAgo(21), type: 'Strength', duration: 58, intensity: 5, metrics: { volumeKg: 5400 } },
    { id: 'w10', date: daysAgo(25), type: 'Yoga', duration: 35, intensity: 2 },
  ],

  goals: [
    {
      id: 'g1', title: 'Run a half marathon', category: 'Fitness', status: 'active', progress: 60,
      targetDate: daysAhead(75), description: 'Build up to 21km by autumn.',
      milestones: [
        { id: 'g1m1', title: 'Run 10k non-stop', done: true },
        { id: 'g1m2', title: 'Run 15k', done: true },
        { id: 'g1m3', title: 'Run 18k', done: false },
        { id: 'g1m4', title: 'Race day', done: false },
      ],
    },
    {
      id: 'g2', title: 'Save 3-month emergency fund', category: 'Finance', status: 'active', progress: 45,
      targetDate: daysAhead(180), description: 'Reach $12,000 in savings.',
      milestones: [
        { id: 'g2m1', title: '$4,000', done: true },
        { id: 'g2m2', title: '$8,000', done: false },
        { id: 'g2m3', title: '$12,000', done: false },
      ],
    },
    {
      id: 'g3', title: 'Read 24 books this year', category: 'Learning', status: 'active', progress: 50,
      targetDate: daysAhead(190), milestones: [],
    },
    {
      id: 'g4', title: 'Launch side project', category: 'Career', status: 'paused', progress: 20,
      description: 'Ship the MVP.', milestones: [{ id: 'g4m1', title: 'Validate idea', done: true }],
    },
    {
      id: 'g5', title: 'Meditate 30 days straight', category: 'Wellbeing', status: 'done', progress: 100,
      milestones: [],
    },
  ],

  tasks: [
    { id: 'k1', title: 'Review monthly budget', priority: 'high', dueDate: daysAhead(1), project: 'Finance', done: false },
    { id: 'k2', title: 'Long run — 16km', priority: 'high', dueDate: daysAhead(2), project: 'Training', done: false },
    { id: 'k3', title: 'Call dentist', priority: 'medium', dueDate: daysAhead(0), project: 'Health', done: false },
    { id: 'k4', title: 'Pay internet bill', priority: 'medium', dueDate: daysAhead(3), project: 'Finance', done: false },
    { id: 'k5', title: 'Outline side project MVP', priority: 'low', dueDate: daysAhead(6), project: 'Career', done: false },
    { id: 'k6', title: 'Buy running shoes', priority: 'medium', project: 'Training', done: false },
    { id: 'k7', title: 'Finish current book', priority: 'low', dueDate: daysAhead(9), project: 'Learning', done: true },
    { id: 'k8', title: 'Meal prep for the week', priority: 'medium', dueDate: daysAgo(1), project: 'Health', done: true },
  ],

  visionItems: [
    { id: 'v1', title: 'Marathon finish line', caption: 'Cross 21km this year', category: 'Fitness', imageUrl: 'https://picsum.photos/seed/run/480/360', position: { x: 24, y: 24 } },
    { id: 'v2', title: 'Mountain cabin', caption: 'Quiet place to write', category: 'Lifestyle', imageUrl: 'https://picsum.photos/seed/cabin/480/360', position: { x: 360, y: 60 } },
    { id: 'v3', title: 'Financial freedom', caption: 'Investments working for me', category: 'Finance', imageUrl: 'https://picsum.photos/seed/money/480/360', position: { x: 120, y: 300 } },
    { id: 'v4', title: 'Travel — Japan', caption: 'Spring in Kyoto', category: 'Travel', imageUrl: 'https://picsum.photos/seed/kyoto/480/360', position: { x: 480, y: 340 } },
  ],

  calendarEvents: [
    { id: 'e1', title: 'Team standup', start: at(0, 9), end: at(0, 9, 30), source: 'local' },
    { id: 'e2', title: 'Long run', start: at(2, 7), end: at(2, 9), description: '16km route', source: 'local' },
    { id: 'e3', title: 'Dentist appointment', start: at(0, 15), end: at(0, 16), source: 'local' },
    { id: 'e4', title: 'Budget review', start: at(1, 18), end: at(1, 19), source: 'local' },
  ],
};
