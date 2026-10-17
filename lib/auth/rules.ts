/**
 * Pure role rules (no database). Used by lib/auth/session.ts and tested in tests/auth.
 * Only is_hr_admin is stored. Manager is derived: anyone who is the
 * reporting_manager_id of at least one active employee.
 */
import type { ISODate } from "@/lib/dates";

export type Actor = {
  employeeId: string;
  isHr: boolean;
  isManager: boolean;
  directReportIds: string[];
};

export function isActiveOn(emp: { last_working_day: string | null }, today: ISODate): boolean {
  return !emp.last_working_day || emp.last_working_day >= today;
}

export type AccessDecision = { ok: true } | { ok: false; reason: "unknown" | "exited" };

/** Can this employee row sign in today? (Deactivated after their last working day ⇒ no.) */
export function accessDecision(emp: { last_working_day: string | null } | null, today: ISODate): AccessDecision {
  if (!emp) return { ok: false, reason: "unknown" };
  if (!isActiveOn(emp, today)) return { ok: false, reason: "exited" };
  return { ok: true };
}

/** Manager is derived from active direct reports. */
export function deriveDirectReports(
  me: string,
  employees: { id: string; reporting_manager_id: string | null; last_working_day: string | null }[],
  today: ISODate,
): string[] {
  return employees.filter((e) => e.reporting_manager_id === me && isActiveOn(e, today)).map((e) => e.id);
}

/** Full profile (incl. masked statutory/bank): only yourself or HR. */
export function canViewEmployee(actor: Actor, targetId: string): boolean {
  return actor.isHr || actor.employeeId === targetId;
}

/** Team data (attendance, leave calendar, approvals): HR for everyone, managers for direct reports. Never yourself as approver. */
export function canManageEmployee(actor: Actor, targetId: string): boolean {
  if (targetId === actor.employeeId) return false;
  return actor.isHr || actor.directReportIds.includes(targetId);
}

/** Approve or reject a request: HR or the direct manager, never the applicant. */
export function canDecideFor(actor: Actor, applicantId: string): boolean {
  return canManageEmployee(actor, applicantId);
}
