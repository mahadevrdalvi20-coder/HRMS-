import "server-only";
import { db, must } from "@/lib/db";
import { todayIST } from "@/lib/dates";
import { deriveDirectReports } from "@/lib/auth/rules";
import type { Session } from "@/lib/auth";
import type { Employee, Location } from "@/lib/types";

/** Build a Session for a seeded email WITHOUT Clerk. Only used by the local attack-test script. */
export async function sessionForEmail(email: string): Promise<Session> {
  const sb = db();
  const emp = must(await sb.from("employees").select("*").eq("email", email.toLowerCase()).single(), `employee ${email}`) as Employee;
  const today = todayIST();
  const reports = must(await sb.from("employees").select("id, reporting_manager_id, last_working_day").eq("reporting_manager_id", emp.id), "reports") as { id: string; reporting_manager_id: string | null; last_working_day: string | null }[];
  const directReportIds = deriveDirectReports(emp.id, reports, today);
  const location = must(await sb.from("locations").select("*").eq("id", emp.location_id).single(), "location") as Location;
  return { employeeId: emp.id, employee: emp, isHr: emp.is_hr_admin, isManager: directReportIds.length > 0, directReportIds, location, today };
}
