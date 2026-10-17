/**
 * Apply / cancel / approve rules for leave (RESEARCH.md §9). Pure functions.
 */
import { addDays, diffDays, isValidISODate, yearOf, type ISODate } from "@/lib/dates";
import type { LeaveType } from "@/lib/types";
import type { DayCount } from "./workingDays";

export const MAX_DAYS_IN_PAST = 30;

export type ApplyCheck = {
  ok: boolean;
  errors: string[];
  needsCertificate: boolean;
  /** Set when the balance is short: how many days would become LOP. */
  lopOffer: { typedDays: number; lopDays: number } | null;
};

export function validateLeaveApplication(input: {
  type: Pick<LeaveType, "code" | "half_day_allowed" | "requires_certificate_after_days" | "gender_restriction" | "is_active">;
  from: string;
  to: string;
  isHalfDay: boolean;
  reason: string;
  hasCertificate: boolean;
  today: ISODate;
  employee: { date_of_joining: ISODate; last_working_day: ISODate | null; gender: string };
  count: DayCount;
  available: number | null; // null = unlimited
  overlapsExisting: boolean;
}): ApplyCheck {
  const errors: string[] = [];
  const { type, from, to, count } = input;
  let needsCertificate = false;
  let lopOffer: ApplyCheck["lopOffer"] = null;

  if (!type.is_active) errors.push("This leave type is not available");
  if (!isValidISODate(from) || !isValidISODate(to)) {
    errors.push("Pick valid dates");
    return { ok: false, errors, needsCertificate, lopOffer };
  }
  if (to < from) errors.push("The end date is before the start date");
  if (yearOf(from) !== yearOf(to)) errors.push("A request must stay inside one leave year (Jan–Dec). Split it into two requests.");
  if (from < addDays(input.today, -MAX_DAYS_IN_PAST)) errors.push(`Leave cannot be applied more than ${MAX_DAYS_IN_PAST} days in the past`);
  if (from < input.employee.date_of_joining) errors.push("The dates are before your joining date");
  if (input.employee.last_working_day && to > input.employee.last_working_day) errors.push("The dates are after your last working day");
  if (input.isHalfDay && !type.half_day_allowed) errors.push(`${type.code} cannot be taken as a half day`);
  if (input.isHalfDay && from !== to) errors.push("A half day must be a single date");
  if (type.gender_restriction && input.employee.gender !== type.gender_restriction) errors.push(`${type.code} is available to ${type.gender_restriction.toLowerCase()} employees only`);
  if (!input.reason || input.reason.trim().length < 3) errors.push("Enter a reason");
  if (input.overlapsExisting) errors.push("You already have a pending or approved leave on these dates");
  if (count.days <= 0 && to >= from) errors.push("There are no working days in this range (only weekly offs or holidays)");

  if (type.requires_certificate_after_days !== null && count.days > Number(type.requires_certificate_after_days)) {
    needsCertificate = true;
    if (!input.hasCertificate) errors.push(`${type.code} of more than ${type.requires_certificate_after_days} days needs a medical certificate upload`);
  }

  if (input.available !== null && count.days > input.available) {
    const typedDays = Math.max(0, Math.floor(input.available));
    lopOffer = { typedDays, lopDays: count.days - typedDays };
  }

  return { ok: errors.length === 0 && !lopOffer, errors, needsCertificate, lopOffer };
}

/** Split a request into the part the balance covers and the LOP remainder (earliest days use the balance). */
export function splitForLop(countedDates: ISODate[], typedDays: number) {
  const typed = countedDates.slice(0, typedDays);
  const lop = countedDates.slice(typedDays);
  return {
    typed: typed.length ? { from: typed[0], to: typed[typed.length - 1], days: typed.length } : null,
    lop: lop.length ? { from: lop[0], to: lop[lop.length - 1], days: lop.length } : null,
  };
}

/** L5 — own request; pending, or approved and not yet started. */
export function canCancel(req: { employee_id: string; status: string; from_date: ISODate }, actorId: string, today: ISODate): boolean {
  if (req.employee_id !== actorId) return false;
  if (req.status === "pending") return true;
  return req.status === "approved" && req.from_date > today;
}

/** Approval re-check: after counting this request as pending, the balance must not be negative. */
export function balanceAllowsApproval(availableIncludingThisPending: number | null): boolean {
  return availableIncludingThisPending === null || availableIncludingThisPending >= 0;
}

export function datesOverlap(aFrom: ISODate, aTo: ISODate, bFrom: ISODate, bTo: ISODate): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

export function daysUntil(today: ISODate, date: ISODate) {
  return diffDays(today, date);
}
