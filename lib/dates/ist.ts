/**
 * All IST date helpers. India has no daylight saving, so IST is always UTC+05:30.
 * We shift the instant by +05:30 and read the UTC fields, which gives the IST
 * wall clock no matter what time zone the server runs in.
 *
 * Calendar dates are passed around as "YYYY-MM-DD" strings (the same format as a
 * Postgres `date`), so a date never silently moves across midnight.
 */

export const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ISODate = string; // YYYY-MM-DD

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

export function toISTParts(instant: Date | string) {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    dayOfWeek: shifted.getUTCDay(),
  };
}

/** Calendar date in IST for an instant. */
export function toISTDateString(instant: Date | string): ISODate {
  const p = toISTParts(instant);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function todayIST(now: Date = new Date()): ISODate {
  return toISTDateString(now);
}

/** "09:42" in IST. */
export function formatISTTime(instant: Date | string | null | undefined): string {
  if (!instant) return "—";
  const p = toISTParts(instant);
  return `${pad(p.hours)}:${pad(p.minutes)}`;
}

/** Seconds since IST midnight. */
export function secondsOfDayIST(instant: Date | string): number {
  const p = toISTParts(instant);
  return p.hours * 3600 + p.minutes * 60 + p.seconds;
}

/** Build the UTC instant for an IST wall-clock time on an IST date ("2026-10-16", "09:30"). */
export function istDateTimeToUtc(date: ISODate, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm, ss) - IST_OFFSET_MS);
}

// ---------- pure calendar arithmetic on YYYY-MM-DD strings ----------

function toUtcMidnight(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMidnight(ms: number): ISODate {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function isValidISODate(s: unknown): s is ISODate {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return fromUtcMidnight(toUtcMidnight(s)) === s;
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromUtcMidnight(toUtcMidnight(date) + n * DAY_MS);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(date: ISODate): number {
  return new Date(toUtcMidnight(date)).getUTCDay();
}

/** b − a in days. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUtcMidnight(b) - toUtcMidnight(a)) / DAY_MS);
}

export function eachDate(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthRange(year: number, month: number): { from: ISODate; to: ISODate } {
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`,
  };
}

export function yearOf(date: ISODate): number {
  return Number(date.slice(0, 4));
}

export function monthOf(date: ISODate): number {
  return Number(date.slice(5, 7));
}

/** Same day-of-month n years later (29 Feb → 28 Feb). */
export function addYears(date: ISODate, n: number): ISODate {
  const [y, m, d] = date.split("-").map(Number);
  const target = y + n;
  const day = Math.min(d, daysInMonth(target, m));
  return `${target}-${pad(m)}-${pad(day)}`;
}

/** Same day-of-month n months later, clamped to month end. */
export function addMonths(date: ISODate, n: number): ISODate {
  const [y, m, d] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ty = Math.floor(total / 12);
  const tm = (total % 12) + 1;
  return `${ty}-${pad(tm)}-${pad(Math.min(d, daysInMonth(ty, tm)))}`;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function dayName(date: ISODate): string {
  return DOW[dayOfWeek(date)];
}

/** "Fri, 16 Oct 2026" */
export function formatDate(date: ISODate | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-").map(Number);
  return `${DOW[dayOfWeek(date)]}, ${d} ${MON[m - 1]} ${y}`;
}

/** "16 Oct 2026, 09:42 IST" */
export function formatISTDateTime(instant: Date | string | null | undefined): string {
  if (!instant) return "—";
  const p = toISTParts(instant);
  return `${p.day} ${MON[p.month - 1]} ${p.year}, ${pad(p.hours)}:${pad(p.minutes)} IST`;
}

export function parseMonthParam(param: string | undefined, fallback: ISODate): { year: number; month: number } {
  if (param && /^\d{4}-\d{2}$/.test(param)) {
    const [y, m] = param.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m };
  }
  return { year: yearOf(fallback), month: monthOf(fallback) };
}

export function monthParam(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}
