import "server-only";
import { db, must } from "@/lib/db";
import { yearOf } from "@/lib/dates";
import { isActiveOn } from "@/lib/auth/rules";
import type { Session } from "@/lib/auth";
import type { Employee, LeaveRequest, RegularisationRequest } from "@/lib/types";
import { getBalances, leaveTypes, requestsFor } from "@/lib/leave/queries";

/**
 * Requests waiting on this approver: HR sees every employee's, a manager sees direct reports'.
 * Nobody ever sees their own request here.
 */
export async function pendingForApprover(s: Session) {
  const sb = db();
  const scope = s.isHr ? null : s.directReportIds;
  if (scope && scope.length === 0) return { leave: [], regularisation: [] };
  let lq = sb.from("leave_requests").select("*").eq("status", "pending").neq("employee_id", s.employeeId).order("created_at");
  let rq = sb.from("regularisation_requests").select("*").eq("status", "pending").neq("employee_id", s.employeeId).order("created_at");
  if (scope) {
    lq = lq.in("employee_id", scope);
    rq = rq.in("employee_id", scope);
  }
  const [l, r] = await Promise.all([lq, rq]);
  return { leave: must(l, "pending leave") as LeaveRequest[], regularisation: must(r, "pending corrections") as RegularisationRequest[] };
}

/** Pending leave with balance before/after and clashes with other team members. */
export async function approvalDetails(s: Session) {
  const pending = await pendingForApprover(s);
  const sb = db();
  const empIds = [...new Set([...pending.leave.map((x) => x.employee_id), ...pending.regularisation.map((x) => x.employee_id)])];
  const emps = empIds.length ? (must(await sb.from("employees").select("*").in("id", empIds), "employees") as Employee[]) : [];
  const types = await leaveTypes(false);

  const leave = await Promise.all(
    pending.leave.map(async (r) => {
      const emp = emps.find((e) => e.id === r.employee_id)!;
      const bal = (await getBalances(emp, yearOf(r.from_date), s.today)).find((b) => b.type.id === r.leave_type_id);
      // Same-manager colleagues with pending/approved leave on overlapping dates.
      const peers = emp.reporting_manager_id
        ? (must(await sb.from("employees").select("id, full_name, last_working_day").eq("reporting_manager_id", emp.reporting_manager_id).neq("id", emp.id), "peers") as { id: string; full_name: string; last_working_day: string | null }[]).filter((p) => isActiveOn(p, s.today))
        : [];
      const overlaps = await requestsFor(peers.map((p) => p.id), r.from_date, r.to_date);
      return {
        request: r,
        employee: emp,
        type: types.find((t) => t.id === r.leave_type_id),
        // available already has this request counted as pending
        availableNow: bal?.available === null || bal?.available === undefined ? null : bal.available + Number(r.days),
        availableAfter: bal?.available ?? null,
        clashes: overlaps.map((o) => ({ name: peers.find((p) => p.id === o.employee_id)?.full_name ?? "", from: o.from_date, to: o.to_date, status: o.status })),
      };
    }),
  );
  const regularisation = pending.regularisation.map((r) => ({ request: r, employee: emps.find((e) => e.id === r.employee_id)! }));
  return { leave, regularisation };
}
