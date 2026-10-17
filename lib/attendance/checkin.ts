/** Decide what a Check-in click does. One record per employee per day (also enforced by a unique constraint). */
import type { ISODate } from "@/lib/dates";
import { isLate } from "./rules";

export type CheckInPlan =
  | { kind: "exists" }
  | { kind: "not-joined" }
  | { kind: "create"; row: { date: ISODate; check_in: string; is_wfh: boolean; is_late: boolean } };

export function planCheckIn(existing: { check_in: string | null } | null, now: Date, today: ISODate, joinDate: ISODate, isWfh: boolean): CheckInPlan {
  if (today < joinDate) return { kind: "not-joined" };
  if (existing?.check_in) return { kind: "exists" };
  return { kind: "create", row: { date: today, check_in: now.toISOString(), is_wfh: isWfh, is_late: isLate(now) } };
}
