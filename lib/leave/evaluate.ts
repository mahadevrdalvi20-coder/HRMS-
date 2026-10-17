import "server-only";
import { db, must } from "@/lib/db";
import { yearOf } from "@/lib/dates";
import type { Session } from "@/lib/auth";
import type { LeaveType } from "@/lib/types";
import { holidaysFor } from "@/lib/attendance/queries";
import { teamClashes } from "./clashes";
import { countLeaveDays, type DayCount } from "./workingDays";
import { datesOverlap, validateLeaveApplication, type ApplyCheck } from "./rules";
import { balanceFor, leaveTypes } from "./queries";

/**
 * Evaluate a leave application for a session without saving anything.
 * Used by the Apply form preview, the submit action and the agent's draft_leave_request tool,
 * so every path runs exactly the same rules.
 */
export type LeaveForm = { leaveTypeId: string; from: string; to: string; isHalfDay: boolean; reason: string };

export type LeavePreview = {
  type: Pick<LeaveType, "id" | "code" | "name" | "half_day_allowed"> | null;
  count: DayCount;
  check: ApplyCheck;
  balanceBefore: number | null;
  balanceAfter: number | null;
  clashes: { name: string; dates: string }[];
};

export async function evaluateLeave(s: Session, f: LeaveForm, hasCertificate: boolean): Promise<LeavePreview & { typeRow?: LeaveType }> {
  const types = await leaveTypes();
  const type = types.find((t) => t.id === f.leaveTypeId);
  const empty: DayCount = { days: 0, countedDates: [], skipped: [] };
  if (!type) {
    return { type: null, count: empty, check: { ok: false, errors: ["Pick a leave type"], needsCertificate: false, lopOffer: null }, balanceBefore: null, balanceAfter: null, clashes: [] };
  }
  const isHalfDay = f.isHalfDay && type.half_day_allowed;
  const to = isHalfDay ? f.from : f.to;
  const holidays = f.from && to && f.from <= to ? await holidaysFor(s.employee.location_id, f.from, to) : [];
  const count = countLeaveDays({ from: f.from, to, weeklyOffDays: s.location.weekly_off_days, holidays, isHalfDay, countCalendarDays: type.count_calendar_days });
  const year = f.from ? yearOf(f.from) : yearOf(s.today);
  const bal = await balanceFor(s.employee, type.id, year, s.today);
  const existing = f.from && to
    ? (must(await db().from("leave_requests").select("from_date, to_date").eq("employee_id", s.employeeId).in("status", ["pending", "approved"]).lte("from_date", to).gte("to_date", f.from), "overlap") as { from_date: string; to_date: string }[])
    : [];
  const check = validateLeaveApplication({
    type, from: f.from, to, isHalfDay: f.isHalfDay, reason: f.reason, hasCertificate, today: s.today,
    employee: s.employee, count, available: bal?.available ?? null,
    overlapsExisting: existing.some((e) => datesOverlap(e.from_date, e.to_date, f.from, to)),
  });
  const clashes = f.from && to ? await teamClashes(s.employee, f.from, to) : [];
  return {
    type: { id: type.id, code: type.code, name: type.name, half_day_allowed: type.half_day_allowed },
    typeRow: type,
    count,
    check,
    balanceBefore: bal?.available ?? null,
    balanceAfter: bal?.available === null || bal?.available === undefined ? null : bal.available - count.days,
    clashes,
  };
}

