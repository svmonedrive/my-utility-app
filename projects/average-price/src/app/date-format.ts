const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parses "20-Jan-2026" (case-insensitive month, 1 or 2 digit day). Returns null if not a real date. */
export function parseDate(text: string): Date | null {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(text.trim());
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const month = MONTHS.findIndex((m) => m.toLowerCase() === match[2].toLowerCase());
  const year = Number(match[3]);
  if (month < 0) {
    return null;
  }
  const date = new Date(year, month, day);
  const real = date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
  return real ? date : null;
}

/** Formats a date as "20-Jan-2026". */
export function formatDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`;
}

/** The value format of `<input type="date">`: "2026-01-20" -> Date. Null if empty or not a real date. */
export function parseIsoDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const real =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? date : null;
}

/** Date -> "2026-01-20", the value format of `<input type="date">`. */
export function toIsoDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
