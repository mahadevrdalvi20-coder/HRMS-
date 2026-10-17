import "server-only";
import { db, must } from "@/lib/db";
import type { Session } from "@/lib/auth";
import { isActiveOn } from "@/lib/auth/rules";
import { monthRange } from "@/lib/dates";
import { monthsFor } from "@/lib/attendance/queries";
import { leaveTypes } from "@/lib/leave/queries";
import type { Department, Employee } from "@/lib/types";
import { summaryRow } from "./summary";

/** Managers: their direct reports. HR: everyone employed at any point in the month. */
export async function monthEndSummary(s: Session, year: number, month: number, filters: { location?: string; department?: string } = {}) {
  const sb = db();
  const { from, to } = monthRange(year, month);
  const [emps, depts, types] = await Promise.all([
    sb.from("employees").select("*").order("employee_code"),
    sb.from("departments").select("*"),
    leaveTypes(false),
  ]);
  let employees = (must(emps, "employees") as Employee[]).filter((e) => e.date_of_joining <= to && isActiveOn(e, from));
  employees = s.isHr ? employees : employees.filter((e) => e.reporting_manager_id === s.employeeId);
  if (filters.location) employees = employees.filter((e) => e.location_id === filters.location);
  if (filters.department) employees = employees.filter((e) => e.department_id === filters.department);
  const departments = must(depts, "departments") as Department[];
  const months = await monthsFor(employees, year, month, s.today);
  const pendingCorrections = employees.length
    ? (must(await sb.from("regularisation_requests").select("employee_id").eq("status", "pending").gte("date", from).lte("date", to).in("employee_id", employees.map((e) => e.id)), "pending corrections") as { employee_id: string }[])
    : [];
  const rows = months.map((m) => {
    const r = summaryRow(m.employee, m.location?.name ?? "", departments.find((d) => d.id === m.employee.department_id)?.name ?? "", m.days, m.summary);
    return { ...r, unresolved: r.unresolved + pendingCorrections.filter((p) => p.employee_id === m.employee.id).length };
  });
  return { rows, leaveCodes: types.map((t) => t.code) };
}
