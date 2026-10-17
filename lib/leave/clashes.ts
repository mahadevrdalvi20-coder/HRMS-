import "server-only";
import { db, must } from "@/lib/db";
import { formatDate, type ISODate } from "@/lib/dates";
import type { Employee, LeaveRequest } from "@/lib/types";
import { requestsFor } from "./queries";

/** Colleagues with the same manager who have pending/approved leave overlapping the range. */
export async function teamClashes(emp: Employee, from: ISODate, to: ISODate): Promise<{ name: string; dates: string }[]> {
  if (!emp.reporting_manager_id) return [];
  const peers = must(
    await db().from("employees").select("id, full_name").eq("reporting_manager_id", emp.reporting_manager_id).neq("id", emp.id),
    "peers",
  ) as { id: string; full_name: string }[];
  const reqs: LeaveRequest[] = await requestsFor(peers.map((p) => p.id), from, to);
  return reqs.map((r) => ({
    name: peers.find((p) => p.id === r.employee_id)?.full_name ?? "Colleague",
    dates: r.from_date === r.to_date ? formatDate(r.from_date) : `${formatDate(r.from_date)} – ${formatDate(r.to_date)}`,
  }));
}
