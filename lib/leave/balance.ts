/**
 * Leave balance (RESEARCH.md §9). "Available" is always calculated, never stored:
 *   available = opening + accrued − used − pending
 * opening = carried forward (stored), used = approved days (stored, changed only by DB functions),
 * pending = sum of pending requests, accrued = calculated here from the leave type and joining date.
 */
import { addMonths, yearOf, type ISODate } from "@/lib/dates";
import type { AccrualMethod } from "@/lib/types";

export const roundHalf = (x: number) => Math.round(x * 2) / 2;

/**
 * Months of the leave year an employee is entitled to for a 1-Jan credit.
 * Joined in an earlier year: 12. Joined this year: from the joining month (if on or
 * before the 15th) or the next month, through December.
 */
export function proRataMonths(dateOfJoining: ISODate, year: number): number {
  const jy = yearOf(dateOfJoining);
  if (jy < year) return 12;
  if (jy > year) return 0;
  const month = Number(dateOfJoining.slice(5, 7));
  const day = Number(dateOfJoining.slice(8, 10));
  const startMonth = day <= 15 ? month : month + 1;
  return Math.max(0, 13 - startMonth);
}

/** Completed months of service inside `year`, up to `asOf`. */
export function completedMonthsInYear(dateOfJoining: ISODate, year: number, asOf: ISODate): number {
  const start = dateOfJoining > `${year}-01-01` ? dateOfJoining : `${year}-01-01`;
  const end = asOf < `${year + 1}-01-01` ? asOf : `${year + 1}-01-01`;
  if (end <= start) return 0;
  let n = 0;
  while (n < 12 && addMonths(start, n + 1) <= end) n++;
  return n;
}

export type AccrualType = { annual_quota: number | null; accrual_method: AccrualMethod; gender_restriction?: string | null };

/** Accrued this leave year. null = unlimited (LOP). */
export function accruedFor(type: AccrualType, emp: { date_of_joining: ISODate; gender?: string }, year: number, asOf: ISODate): number | null {
  if (type.accrual_method === "none" || type.annual_quota === null) return null;
  if (type.gender_restriction && emp.gender && emp.gender !== type.gender_restriction) return 0;
  const quota = Number(type.annual_quota);
  switch (type.accrual_method) {
    case "annual_prorated":
      return roundHalf((quota * proRataMonths(emp.date_of_joining, year)) / 12);
    case "monthly":
      return Math.min(quota, roundHalf2((quota / 12) * completedMonthsInYear(emp.date_of_joining, year, asOf)));
    case "on_request":
      return yearOf(emp.date_of_joining) <= year ? quota : 0;
    default:
      return 0;
  }
}

/** Keep 1.25-style values exact (two decimals). */
function roundHalf2(x: number) {
  return Math.round(x * 100) / 100;
}

export type Balance = { opening: number; accrued: number | null; used: number; pending: number; available: number | null };

export function computeBalance(opening: number, accrued: number | null, used: number, pending: number): Balance {
  const available = accrued === null ? null : roundHalf2(Number(opening) + accrued - Number(used) - Number(pending));
  return { opening: Number(opening), accrued, used: Number(used), pending: Number(pending), available };
}

/** Year-end: EL carries forward up to the cap; CL/SL lapse. */
export function carryForward(available: number | null, carryForwardMax: number): number {
  if (available === null || available <= 0) return 0;
  return Math.min(available, carryForwardMax);
}
