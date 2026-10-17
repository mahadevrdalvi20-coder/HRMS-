import "server-only";
import { db, must } from "@/lib/db";
import { monthRange, todayIST, type ISODate } from "@/lib/dates";
import { isActiveOn } from "@/lib/auth/rules";
import type { AttendanceRow, Employee, Holiday, LeaveType, Location, RegularisationRequest } from "@/lib/types";
import { buildMonth, type LeaveSpan } from "./month";

export async function holidaysFor(locationId: string, from: ISODate, to: ISODate): Promise<Holiday[]> {
  return must(
    await db().from("holidays").select("*").eq("location_id", locationId).gte("date", from).lte("date", to).order("date"),
    "holidays",
  ) as Holiday[];
}

/** Approved leave spans overlapping [from, to] for many employees. */
export async function approvedLeaves(employeeIds: string[], from: ISODate, to: ISODate): Promise<(LeaveSpan & { employee_id: string })[]> {
  if (employeeIds.length === 0) return [];
  const sb = db();
  const [reqs, types] = await Promise.all([
    sb.from("leave_requests").select("employee_id, leave_type_id, from_date, to_date, is_half_day")
      .in("employee_id", employeeIds).eq("status", "approved").lte("from_date", to).gte("to_date", from),
    sb.from("leave_types").select("*"),
  ]);
  const t = must(types, "leave types") as LeaveType[];
  return (must(reqs, "leaves") as { employee_id: string; leave_type_id: string; from_date: string; to_date: string; is_half_day: boolean }[]).map((r) => {
    const lt = t.find((x) => x.id === r.leave_type_id);
    return { ...r, code: lt?.code ?? "?", count_calendar_days: lt?.count_calendar_days ?? false };
  });
}

/** Month view for a set of employees, batched (used by team view and reports). */
export async function monthsFor(employees: Employee[], year: number, month: number, today: ISODate = todayIST()) {
  const { from, to } = monthRange(year, month);
  const sb = db();
  const ids = employees.map((e) => e.id);
  const locIds = [...new Set(employees.map((e) => e.location_id))];
  const [locs, hols, att, leaves] = await Promise.all([
    sb.from("locations").select("*").in("id", locIds.length ? locIds : ["00000000-0000-0000-0000-000000000000"]),
    sb.from("holidays").select("*").in("location_id", locIds.length ? locIds : ["00000000-0000-0000-0000-000000000000"]).gte("date", from).lte("date", to),
    ids.length ? sb.from("attendance").select("*").in("employee_id", ids).gte("date", from).lte("date", to) : Promise.resolve({ data: [], error: null }),
    approvedLeaves(ids, from, to),
  ]);
  const locations = must(locs, "locations") as Location[];
  const holidays = must(hols, "holidays") as Holiday[];
  const attendance = must(att, "attendance") as AttendanceRow[];
  return employees.map((e) => ({
    employee: e,
    location: locations.find((l) => l.id === e.location_id)!,
    ...buildMonth({
      year, month, today,
      joinDate: e.date_of_joining,
      lastWorkingDay: e.last_working_day,
      weeklyOffDays: locations.find((l) => l.id === e.location_id)?.weekly_off_days ?? [0],
      holidays: holidays.filter((h) => h.location_id === e.location_id),
      leaves: leaves.filter((l) => l.employee_id === e.id),
      attendance: attendance.filter((a) => a.employee_id === e.id),
    }),
  }));
}

export async function myMonth(employee: Employee, year: number, month: number, today: ISODate) {
  const [m] = await monthsFor([employee], year, month, today);
  return m;
}

export async function todayRecord(employeeId: string, today: ISODate): Promise<AttendanceRow | null> {
  return must(await db().from("attendance").select("*").eq("employee_id", employeeId).eq("date", today).maybeSingle(), "today") as AttendanceRow | null;
}

/** Team in scope: HR sees every active employee, a manager sees active direct reports. */
export async function teamInScope(session: { employeeId: string; isHr: boolean; directReportIds: string[]; today: ISODate }): Promise<Employee[]> {
  const sb = db();
  const q = session.isHr
    ? sb.from("employees").select("*").order("full_name")
    : sb.from("employees").select("*").in("id", session.directReportIds.length ? session.directReportIds : ["00000000-0000-0000-0000-000000000000"]).order("full_name");
  const rows = must(await q, "team") as Employee[];
  return rows.filter((e) => isActiveOn(e, session.today) && e.id !== session.employeeId);
}

/** Who is present / on leave / absent today. */
export async function teamToday(team: Employee[], today: ISODate) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const months = await monthsFor(team, y, m, today);
  return months.map((x) => ({ employee: x.employee, location: x.location, day: x.days.find((d) => d.date === today)! }));
}

export async function myRegularisations(employeeId: string): Promise<RegularisationRequest[]> {
  return must(
    await db().from("regularisation_requests").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(20),
    "regularisations",
  ) as RegularisationRequest[];
}
