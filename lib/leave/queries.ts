import "server-only";
import { db, must } from "@/lib/db";
import { yearOf, type ISODate } from "@/lib/dates";
import type { Employee, LeaveBalanceRow, LeaveRequest, LeaveType } from "@/lib/types";
import { accruedFor, computeBalance, type Balance } from "./balance";

export async function leaveTypes(activeOnly = true): Promise<LeaveType[]> {
  let q = db().from("leave_types").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  return must(await q, "leave types") as LeaveType[];
}

export type BalanceLine = Balance & { type: LeaveType; eligible: boolean };

/**
 * L2 — balance per leave type for one employee and year.
 * available = opening + accrued − used − pending (calculated here, never stored).
 */
export async function getBalances(emp: Employee, year: number, asOf: ISODate): Promise<BalanceLine[]> {
  const sb = db();
  const [types, rows, pend] = await Promise.all([
    leaveTypes(),
    sb.from("leave_balances").select("*").eq("employee_id", emp.id).eq("year", year),
    sb.from("leave_requests").select("leave_type_id, days, from_date").eq("employee_id", emp.id).eq("status", "pending")
      .gte("from_date", `${year}-01-01`).lte("from_date", `${year}-12-31`),
  ]);
  const balances = must(rows, "balances") as LeaveBalanceRow[];
  const pending = must(pend, "pending") as { leave_type_id: string; days: number }[];
  return types.map((t) => {
    const b = balances.find((x) => x.leave_type_id === t.id);
    const p = pending.filter((x) => x.leave_type_id === t.id).reduce((a, x) => a + Number(x.days), 0);
    const accrued = accruedFor(t, emp, year, asOf);
    const eligible = !t.gender_restriction || t.gender_restriction === emp.gender;
    return { type: t, eligible, ...computeBalance(Number(b?.opening ?? 0), accrued, Number(b?.used ?? 0), p) };
  });
}

export async function balanceFor(emp: Employee, typeId: string, year: number, asOf: ISODate): Promise<BalanceLine | undefined> {
  return (await getBalances(emp, year, asOf)).find((b) => b.type.id === typeId);
}

export type RequestRow = LeaveRequest & { type: LeaveType | undefined; employee?: Employee; approver_name?: string | null };

export async function myRequests(employeeId: string): Promise<RequestRow[]> {
  const sb = db();
  const [reqs, types] = await Promise.all([
    sb.from("leave_requests").select("*").eq("employee_id", employeeId).order("from_date", { ascending: false }).limit(50),
    leaveTypes(false),
  ]);
  const rows = must(reqs, "requests") as LeaveRequest[];
  const approverIds = [...new Set(rows.map((r) => r.approver_id).filter(Boolean))] as string[];
  const approvers = approverIds.length ? (must(await sb.from("employees").select("id, full_name").in("id", approverIds), "approvers") as { id: string; full_name: string }[]) : [];
  return rows.map((r) => ({ ...r, type: types.find((t) => t.id === r.leave_type_id), approver_name: approvers.find((a) => a.id === r.approver_id)?.full_name ?? null }));
}

/** Leave requests (any status) for a set of employees overlapping a range — for clashes and the calendar. */
export async function requestsFor(employeeIds: string[], from: ISODate, to: ISODate, statuses: string[] = ["pending", "approved"]): Promise<LeaveRequest[]> {
  if (!employeeIds.length) return [];
  return must(
    await db().from("leave_requests").select("*").in("employee_id", employeeIds).in("status", statuses).lte("from_date", to).gte("to_date", from),
    "requests",
  ) as LeaveRequest[];
}

export function yearOfRequest(r: { from_date: string }) {
  return yearOf(r.from_date);
}
