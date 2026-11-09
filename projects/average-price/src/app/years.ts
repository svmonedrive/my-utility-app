// The year-wise files of the app: one file of orders per year, and an index that lists the years.
//
//   average-price-app-data/index.json   { "years": [2026, 2027] }
//   average-price-app-data/2026.json    the orders of 2026
//   average-price-app-data/2027.json    the orders of 2027

/** The index: which years have a file. */
export interface YearsIndex {
  years: number[];
}

/** File name of the index, inside the app's data folder. */
export const INDEX_FILE = 'index.json';

/** File name of the orders of `year`, inside the app's data folder. */
export const yearFile = (year: number): string => `${year}.json`;

/** The years of an index as a clean list: whole numbers only, no repeats, oldest first. */
export function yearsOf(index: YearsIndex | null | undefined): number[] {
  const years = (index?.years ?? []).filter((year) => Number.isInteger(year));
  return [...new Set(years)].sort((a, b) => a - b);
}

/**
 * The year to show: `wanted` if it has a file, else the current year if it has one, else the latest
 * year. Null when there are no years at all.
 */
export function pickYear(
  years: readonly number[],
  currentYear: number,
  wanted?: number | null,
): number | null {
  if (wanted != null && years.includes(wanted)) {
    return wanted;
  }
  if (years.includes(currentYear)) {
    return currentYear;
  }
  return years.length ? years[years.length - 1] : null;
}

/** The year the "Create … file" button would add: the one after the latest, or this year if there is none yet. */
export function nextYearAfter(years: readonly number[], currentYear: number): number {
  return years.length ? years[years.length - 1] + 1 : currentYear;
}

/**
 * Whether the next year may be added. Files can be created up to next year only: in 2026 that is 2027,
 * and once 2027 exists no further year can be added until 2027 has arrived.
 */
export function canAddYear(years: readonly number[], currentYear: number): boolean {
  return nextYearAfter(years, currentYear) <= currentYear + 1;
}
