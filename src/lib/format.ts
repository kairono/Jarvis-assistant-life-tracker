// Small shared formatting helpers used across pages and the AI context.

/** All amounts are stored in tenge. */
export const BASE_CURRENCY = 'KZT';

export const money = (n: number): string =>
  n.toLocaleString(undefined, {
    style: 'currency',
    currency: BASE_CURRENCY,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  });

export const money2 = (n: number): string =>
  n.toLocaleString(undefined, {
    style: 'currency',
    currency: BASE_CURRENCY,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  });

export const usd = (n: number): string =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

export const shortDate = (iso: string): string => {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const dateTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const monthKey = (iso: string): string => iso.slice(0, 7); // YYYY-MM

export const isThisMonth = (iso: string): boolean => monthKey(iso) === monthKey(new Date().toISOString());

/** Days from today (negative = past). */
export const daysFromNow = (iso: string): number => {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
};

export const relativeDay = (iso: string): string => {
  const n = daysFromNow(iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n}d ago`;
  return `in ${n}d`;
};
