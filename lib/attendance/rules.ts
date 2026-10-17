/**
 * Attendance rules (RESEARCH.md §9). Pure functions, no database.
 *
 * Priority for one day:
 *   not employed that day  → NONE
 *   approved leave         → On Leave (even if the employee punched in)
 *   location holiday       → Holiday   (National / State; Optional holidays stay working days)
 *   location weekly off    → Weekly Off
 *   punches                → Present / WFH (8h+), Half Day (4h to <8h), Absent (<4h, or no check-out on a past day, or no punch)
 * Late = check-in strictly after 10:15 IST. Every 3rd Late in a calendar month = 0.5 day LOP.
 */
import { dayOfWeek, secondsOfDayIST, type ISODate } from "@/lib/dates";

export type DayStatus = "P" | "WFH" | "HD" | "A" | "L" | "H" | "WO" | "NONE";

export const STATUS_META: Record<DayStatus | "LT", { label: string; code: string; cls: string }> = {
  P: { label: "Present", code: "P", cls: "st-P" },
  WFH: { label: "Work from home", code: "WFH", cls: "st-WFH" },
  HD: { label: "Half Day", code: "HD", cls: "st-HD" },
  A: { label: "Absent", code: "A", cls: "st-A" },
  L: { label: "On Leave", code: "L", cls: "st-L" },
  H: { label: "Holiday", code: "H", cls: "st-H" },
  WO: { label: "Weekly Off", code: "WO", cls: "st-WO" },
  LT: { label: "Late", code: "LT", cls: "st-LT" },
  NONE: { label: "—", code: "", cls: "st-NONE" },
};

export const LATE_AFTER_SECONDS = 10 * 3600 + 15 * 60; // 10:15:00 IST
export const FULL_DAY_HOURS = 8;
export const HALF_DAY_HOURS = 4;
export const LATES_PER_HALF_DAY_LOP = 3;

export function isLate(checkIn: Date | string): boolean {
  return secondsOfDayIST(checkIn) > LATE_AFTER_SECONDS;
}

export function hoursWorked(checkIn: Date | string, checkOut: Date | string): number {
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, ms / 3_600_000);
}

export function statusFromHours(hours: number, isWfh: boolean): "P" | "WFH" | "HD" | "A" {
  if (hours >= FULL_DAY_HOURS) return isWfh ? "WFH" : "P";
  if (hours >= HALF_DAY_HOURS) return "HD";
  return "A";
}

export function isWeeklyOff(date: ISODate, weeklyOffDays: number[]): boolean {
  return weeklyOffDays.includes(dayOfWeek(date));
}

/** Holidays that are days off. Optional (restricted) holidays are listed but are working days. */
export function isOffHoliday(h: { type: string } | null | undefined): boolean {
  return !!h && h.type !== "Optional";
}

export type DayInput = {
  date: ISODate;
  today: ISODate;
  joinDate: ISODate;
  lastWorkingDay: ISODate | null;
  weeklyOffDays: number[];
  holiday?: { name: string; type: string } | null;
  leave?: { code: string; isHalfDay: boolean } | null;
  attendance?: { check_in: string | null; check_out: string | null; is_wfh: boolean } | null;
};

export type DayResult = {
  status: DayStatus;
  inProgress: boolean; // checked in today, not yet out
  hours: number | null;
  missedPunch: boolean;
  late: boolean;
};

export function computeDayStatus(d: DayInput): DayResult {
  const a = d.attendance ?? null;
  const late = !!a?.check_in && isLate(a.check_in);
  const base = { inProgress: false, hours: null as number | null, missedPunch: false, late: false };

  if (d.date < d.joinDate || (d.lastWorkingDay && d.date > d.lastWorkingDay)) return { ...base, status: "NONE" };
  if (d.leave) return { ...base, status: "L" };
  if (isOffHoliday(d.holiday)) return { ...base, status: "H" };
  if (isWeeklyOff(d.date, d.weeklyOffDays)) return { ...base, status: "WO" };

  if (a?.check_in && a.check_out) {
    const hours = hoursWorked(a.check_in, a.check_out);
    return { ...base, status: statusFromHours(hours, a.is_wfh), hours, late };
  }
  if (a?.check_in) {
    if (d.date >= d.today) return { ...base, status: "NONE", inProgress: true, late };
    return { ...base, status: "A", missedPunch: true, late };
  }
  if (d.date < d.today) return { ...base, status: "A", missedPunch: true };
  return { ...base, status: "NONE" };
}

/**
 * Dates that carry a 0.5-day late LOP: the 3rd, 6th, 9th … Late of the month.
 * Input: one month of days in date order.
 */
export function lateLopDates(days: { date: ISODate; late: boolean; status: DayStatus }[]): ISODate[] {
  const out: ISODate[] = [];
  let count = 0;
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!d.late || d.status === "L" || d.status === "H" || d.status === "WO") continue;
    count += 1;
    if (count % LATES_PER_HALF_DAY_LOP === 0) out.push(d.date);
  }
  return out;
}
