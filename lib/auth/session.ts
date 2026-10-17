import "server-only";
import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db, must } from "@/lib/db";
import { todayIST } from "@/lib/dates";
import type { Employee, Location } from "@/lib/types";
import { accessDecision, canDecideFor, canManageEmployee, canViewEmployee, deriveDirectReports, type Actor } from "./rules";

export type Session = Actor & {
  employee: Employee;
  location: Location;
  today: string;
};

type Lookup = { session: Session } | { denied: "signed-out" | "unknown" | "exited" };

/**
 * Link the Clerk user to an employees row and read the role from our database.
 * 1. Match on clerk_user_id; otherwise on email (case-insensitive) and store clerk_user_id.
 * 2. Deny if no row or if the last working day has passed (IST).
 * 3. isHr from employees.is_hr_admin; isManager derived from active direct reports.
 * Cached per request.
 */
const lookup = cache(async (): Promise<Lookup> => {
  const { userId } = await auth();
  if (!userId) return { denied: "signed-out" };
  const today = todayIST();
  const sb = db();

  let employee = must(
    await sb.from("employees").select("*").eq("clerk_user_id", userId).maybeSingle(),
    "load employee",
  ) as Employee | null;

  if (!employee) {
    const user = await currentUser();
    const emails = (user?.emailAddresses ?? [])
      .filter((e) => e.verification?.status === "verified")
      .map((e) => e.emailAddress.toLowerCase());
    for (const email of emails) {
      const found = must(
        await sb.from("employees").select("*").eq("email", email).maybeSingle(),
        "find employee by email",
      ) as Employee | null;
      // An email already linked to a different Clerk user is not taken over.
      if (found && !found.clerk_user_id) {
        must(await sb.from("employees").update({ clerk_user_id: userId }).eq("id", found.id).select("id"), "link clerk user");
        employee = { ...found, clerk_user_id: userId };
        break;
      }
    }
  }

  const decision = accessDecision(employee, today);
  if (!decision.ok) return { denied: decision.reason };
  const me = employee!;

  const [reports, location] = await Promise.all([
    sb.from("employees").select("id, reporting_manager_id, last_working_day").eq("reporting_manager_id", me.id),
    sb.from("locations").select("*").eq("id", me.location_id).single(),
  ]);
  const directReportIds = deriveDirectReports(me.id, must(reports, "load reports") ?? [], today);

  return {
    session: {
      employeeId: me.id,
      employee: me,
      isHr: me.is_hr_admin,
      isManager: directReportIds.length > 0,
      directReportIds,
      location: must(location, "load location") as Location,
      today,
    },
  };
});

/** For pages and server actions: redirects when not allowed. */
export async function requireSession(): Promise<Session> {
  const r = await lookup();
  if ("session" in r) return r.session;
  if (r.denied === "signed-out") redirect("/sign-in");
  redirect(`/access-denied?reason=${r.denied}`);
}

export async function requireHr(): Promise<Session> {
  const s = await requireSession();
  if (!s.isHr) redirect("/no-access");
  return s;
}

export async function requireManagerOrHr(): Promise<Session> {
  const s = await requireSession();
  if (!s.isHr && !s.isManager) redirect("/no-access");
  return s;
}

/** For JSON API routes: returns null instead of redirecting. */
export async function getApiSession(): Promise<Session | null> {
  const r = await lookup();
  return "session" in r ? r.session : null;
}

/** Profile pages: yourself or HR. Anyone else gets a 404 (no hint that the id exists). */
export function assertCanView(s: Session, employeeId: string) {
  if (!canViewEmployee(s, employeeId)) notFound();
}

export { canViewEmployee, canManageEmployee, canDecideFor };
