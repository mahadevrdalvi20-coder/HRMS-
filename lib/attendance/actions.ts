"use server";

import { revalidatePath } from "next/cache";
import { db, must } from "@/lib/db";
import { canDecideFor, requireHr, requireSession } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { diffDays, formatDate, formatISTTime, istDateTimeToUtc, isValidISODate } from "@/lib/dates";
import { appUrl, sendEmail } from "@/lib/email";
import type { ActionResult, AttendanceRow, Employee, RegularisationRequest } from "@/lib/types";
import { planCheckIn } from "./checkin";
import { isLate } from "./rules";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A1/A3 — one click. Time comes from the server clock, stored as an instant; the date is the IST date. */
export async function checkIn(isWfh: boolean): Promise<ActionResult> {
  const s = await requireSession();
  const sb = db();
  const existing = must(await sb.from("attendance").select("*").eq("employee_id", s.employeeId).eq("date", s.today).maybeSingle(), "today") as AttendanceRow | null;
  const plan = planCheckIn(existing, new Date(), s.today, s.employee.date_of_joining, !!isWfh);
  if (plan.kind === "not-joined") return { ok: false, error: "Check-in starts on your first working day" };
  if (plan.kind === "exists") return { ok: true, message: `Already checked in at ${formatISTTime(existing!.check_in)}` };
  // on conflict do nothing: a second tab or double click can never create a second row.
  const { error } = await sb.from("attendance").upsert({ employee_id: s.employeeId, ...plan.row }, { onConflict: "employee_id,date", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  revalidatePath("/attendance");
  return { ok: true, message: `Checked in at ${formatISTTime(plan.row.check_in)} IST${plan.row.is_late ? " · marked Late (after 10:15)" : ""}` };
}

export async function checkOut(): Promise<ActionResult> {
  const s = await requireSession();
  const sb = db();
  const rec = must(await sb.from("attendance").select("*").eq("employee_id", s.employeeId).eq("date", s.today).maybeSingle(), "today") as AttendanceRow | null;
  if (!rec?.check_in) return { ok: false, error: "Check in first" };
  if (rec.check_out) return { ok: true, message: `Already checked out at ${formatISTTime(rec.check_out)}` };
  const now = new Date().toISOString();
  must(await sb.from("attendance").update({ check_out: now }).eq("id", rec.id).is("check_out", null).select("id"), "check out");
  revalidatePath("/");
  revalidatePath("/attendance");
  return { ok: true, message: `Checked out at ${formatISTTime(now)} IST` };
}

/** A5 — request a correction. Attendance is NOT changed until a manager approves. */
export async function requestRegularisation(date: string, inTime: string, outTime: string, reason: string): Promise<ActionResult> {
  const s = await requireSession();
  if (!isValidISODate(date)) return { ok: false, error: "Pick a date" };
  if (date > s.today) return { ok: false, error: "You cannot correct a future day" };
  if (diffDays(date, s.today) > 30) return { ok: false, error: "Corrections are allowed for the last 30 days only" };
  if (date < s.employee.date_of_joining) return { ok: false, error: "That day is before your joining date" };
  if (!TIME_RE.test(inTime) || !TIME_RE.test(outTime)) return { ok: false, error: "Enter times as HH:MM" };
  if (outTime <= inTime) return { ok: false, error: "Check-out must be after check-in" };
  if (!reason || reason.trim().length < 3) return { ok: false, error: "Enter a reason" };

  const sb = db();
  const att = must(await sb.from("attendance").select("id").eq("employee_id", s.employeeId).eq("date", date).maybeSingle(), "attendance") as { id: string } | null;
  const { error } = await sb.from("regularisation_requests").insert({
    employee_id: s.employeeId,
    date,
    attendance_id: att?.id ?? null,
    requested_in: istDateTimeToUtc(date, inTime).toISOString(),
    requested_out: istDateTimeToUtc(date, outTime).toISOString(),
    reason: reason.trim(),
  });
  if (error) {
    if (error.message.includes("reg_one_pending_per_day")) return { ok: false, error: "You already have a pending correction for this day" };
    return { ok: false, error: error.message };
  }
  if (s.employee.reporting_manager_id) {
    const mgr = must(await sb.from("employees").select("email, full_name").eq("id", s.employee.reporting_manager_id).single(), "manager") as { email: string; full_name: string };
    await sendEmail(mgr.email, `Attendance correction from ${s.employee.full_name}`,
      `${s.employee.full_name} asked to correct ${formatDate(date)} to ${inTime}–${outTime} IST.\nReason: ${reason.trim()}\n\nReview: ${appUrl("/approvals")}`);
  }
  revalidatePath("/attendance");
  return { ok: true, message: "Correction sent to your manager. Your attendance changes only after approval." };
}

/** Manager/HR decision on a correction. On approval the times are written and the day status is recalculated. */
export async function decideRegularisation(id: string, approve: boolean, comment: string): Promise<ActionResult> {
  const s = await requireSession();
  const sb = db();
  const req = must(await sb.from("regularisation_requests").select("*").eq("id", id).maybeSingle(), "request") as RegularisationRequest | null;
  if (!req) return { ok: false, error: "Request not found" };
  if (!canDecideFor(s, req.employee_id)) return { ok: false, error: req.employee_id === s.employeeId ? "You cannot approve your own request" : "Only the employee's manager or HR can decide this" };
  if (!approve && (!comment || comment.trim().length < 2)) return { ok: false, error: "Add a comment when rejecting" };

  const updated = must(
    await sb.from("regularisation_requests")
      .update({ status: approve ? "approved" : "rejected", approver_id: s.employeeId, approver_comment: comment?.trim() || null, decided_at: new Date().toISOString() })
      .eq("id", id).eq("status", "pending").select("id"),
    "decide",
  ) as { id: string }[];
  if (updated.length === 0) return { ok: false, error: "This request was already decided. Reload to see the latest." };

  if (approve) {
    must(
      await sb.from("attendance").upsert(
        { employee_id: req.employee_id, date: req.date, check_in: req.requested_in, check_out: req.requested_out, is_late: isLate(req.requested_in), regularised: true },
        { onConflict: "employee_id,date" },
      ).select("id"),
      "apply correction",
    );
  }
  const emp = must(await sb.from("employees").select("email, full_name").eq("id", req.employee_id).single(), "employee") as { email: string; full_name: string };
  await sendEmail(emp.email, `Attendance correction ${approve ? "approved" : "rejected"}`,
    `Your correction for ${formatDate(req.date)} was ${approve ? "approved" : "rejected"} by ${s.employee.full_name}.${comment ? `\nComment: ${comment}` : ""}\n\n${appUrl("/attendance")}`);
  revalidatePath("/approvals");
  return { ok: true, message: approve ? "Approved. Attendance updated." : "Rejected. Attendance unchanged." };
}

/** HR can correct directly, with a mandatory reason that is logged. */
export async function hrCorrectAttendance(employeeId: string, date: string, inTime: string, outTime: string, isWfh: boolean, reason: string): Promise<ActionResult> {
  const s = await requireHr();
  if (employeeId === s.employeeId) return { ok: false, error: "Raise a correction request for your own attendance" };
  if (!isValidISODate(date) || date > s.today) return { ok: false, error: "Pick a past or current date" };
  if (!TIME_RE.test(inTime) || !TIME_RE.test(outTime) || outTime <= inTime) return { ok: false, error: "Enter valid times; check-out after check-in" };
  if (!reason || reason.trim().length < 3) return { ok: false, error: "A reason is required for HR corrections" };
  const sb = db();
  const emp = must(await sb.from("employees").select("*").eq("id", employeeId).maybeSingle(), "employee") as Employee | null;
  if (!emp) return { ok: false, error: "Employee not found" };
  const before = must(await sb.from("attendance").select("*").eq("employee_id", employeeId).eq("date", date).maybeSingle(), "attendance") as AttendanceRow | null;
  const check_in = istDateTimeToUtc(date, inTime).toISOString();
  const check_out = istDateTimeToUtc(date, outTime).toISOString();
  const row = must(
    await sb.from("attendance").upsert({ employee_id: employeeId, date, check_in, check_out, is_wfh: isWfh, is_late: isLate(check_in), regularised: true }, { onConflict: "employee_id,date" }).select("id").single(),
    "correct",
  ) as { id: string };
  await writeAudit([{
    table_name: "attendance", record_id: row.id, field: `attendance ${date}`,
    old_value: before ? `${formatISTTime(before.check_in)}–${formatISTTime(before.check_out)}${before.is_wfh ? " WFH" : ""}` : "no record",
    new_value: `${inTime}–${outTime}${isWfh ? " WFH" : ""}`, action: "correct", reason: reason.trim(), changed_by: s.employeeId,
  }, {
    table_name: "employees", record_id: employeeId, field: `attendance ${date}`,
    old_value: before ? `${formatISTTime(before.check_in)}–${formatISTTime(before.check_out)}` : "no record",
    new_value: `${inTime}–${outTime}`, action: "correct", reason: reason.trim(), changed_by: s.employeeId,
  }]);
  revalidatePath("/attendance/team");
  return { ok: true, message: `Attendance for ${emp.full_name} on ${formatDate(date)} corrected and logged.` };
}
