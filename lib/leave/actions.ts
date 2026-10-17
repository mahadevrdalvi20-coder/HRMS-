"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { db, must } from "@/lib/db";
import { canDecideFor, requireSession, type Session } from "@/lib/auth";
import { yearOf } from "@/lib/dates";
import { appUrl, sendEmail } from "@/lib/email";
import { leaveDecidedEmail, leaveRequestedEmail } from "@/lib/email/templates";
import { holidaysFor } from "@/lib/attendance/queries";
import { teamClashes } from "@/lib/leave/clashes";
import type { ActionResult, Employee, LeaveRequest, LeaveType } from "@/lib/types";
import { countLeaveDays, type DayCount } from "./workingDays";
import { balanceAllowsApproval, canCancel, datesOverlap, splitForLop, validateLeaveApplication, type ApplyCheck } from "./rules";
import { balanceFor, leaveTypes } from "./queries";

export type LeaveForm = { leaveTypeId: string; from: string; to: string; isHalfDay: boolean; reason: string };

export type LeavePreview = {
  type: Pick<LeaveType, "id" | "code" | "name" | "half_day_allowed"> | null;
  count: DayCount;
  check: ApplyCheck;
  balanceBefore: number | null;
  balanceAfter: number | null;
  clashes: { name: string; dates: string }[];
};

async function evaluate(s: Session, f: LeaveForm, hasCertificate: boolean): Promise<LeavePreview & { typeRow?: LeaveType }> {
  const types = await leaveTypes();
  const type = types.find((t) => t.id === f.leaveTypeId);
  const empty: DayCount = { days: 0, countedDates: [], skipped: [] };
  if (!type) {
    return { type: null, count: empty, check: { ok: false, errors: ["Pick a leave type"], needsCertificate: false, lopOffer: null }, balanceBefore: null, balanceAfter: null, clashes: [] };
  }
  const isHalfDay = f.isHalfDay && type.half_day_allowed;
  const to = isHalfDay ? f.from : f.to;
  const holidays = f.from && to && f.from <= to ? await holidaysFor(s.employee.location_id, f.from, to) : [];
  const count = countLeaveDays({ from: f.from, to, weeklyOffDays: s.location.weekly_off_days, holidays, isHalfDay, countCalendarDays: type.count_calendar_days });
  const year = f.from ? yearOf(f.from) : yearOf(s.today);
  const bal = await balanceFor(s.employee, type.id, year, s.today);
  const existing = f.from && to
    ? (must(await db().from("leave_requests").select("from_date, to_date").eq("employee_id", s.employeeId).in("status", ["pending", "approved"]).lte("from_date", to).gte("to_date", f.from), "overlap") as { from_date: string; to_date: string }[])
    : [];
  const check = validateLeaveApplication({
    type, from: f.from, to, isHalfDay: f.isHalfDay, reason: f.reason, hasCertificate, today: s.today,
    employee: s.employee, count, available: bal?.available ?? null,
    overlapsExisting: existing.some((e) => datesOverlap(e.from_date, e.to_date, f.from, to)),
  });
  const clashes = f.from && to ? await teamClashes(s.employee, f.from, to) : [];
  return {
    type: { id: type.id, code: type.code, name: type.name, half_day_allowed: type.half_day_allowed },
    typeRow: type,
    count,
    check,
    balanceBefore: bal?.available ?? null,
    balanceAfter: bal?.available === null || bal?.available === undefined ? null : bal.available - count.days,
    clashes,
  };
}

/** Live preview for the Apply form: day count with skipped days, balance before/after, problems, LOP offer, clashes. */
export async function previewLeave(f: LeaveForm, hasCertificate: boolean): Promise<LeavePreview> {
  const s = await requireSession();
  const { typeRow: _t, ...p } = await evaluate(s, f, hasCertificate);
  return p;
}

async function notifyManager(s: Session, reqs: { code: string; from: string; to: string; days: number }[], reason: string) {
  if (!s.employee.reporting_manager_id) return;
  const mgr = must(await db().from("employees").select("email, full_name").eq("id", s.employee.reporting_manager_id).single(), "manager") as { email: string; full_name: string };
  const mail = leaveRequestedEmail(mgr, s.employee, reqs, reason, appUrl("/approvals"));
  await sendEmail(mail.to, mail.subject, mail.text);
}

/**
 * L3 — submit. All rules are re-checked here on the server. Status Pending; days are held as pending; used is unchanged.
 * With convertToLop the earliest working days use the balance and the rest become a separate LOP request.
 */
export async function applyLeave(formData: FormData): Promise<ActionResult<{ ids: string[] }>> {
  const s = await requireSession();
  const f: LeaveForm = {
    leaveTypeId: String(formData.get("leaveTypeId") ?? ""),
    from: String(formData.get("from") ?? ""),
    to: String(formData.get("to") ?? formData.get("from") ?? ""),
    isHalfDay: formData.get("isHalfDay") === "true",
    reason: String(formData.get("reason") ?? "").trim(),
  };
  const convertToLop = formData.get("convertToLop") === "true";
  const file = formData.get("certificate");
  const hasCertificate = file instanceof File && file.size > 0;
  if (hasCertificate && (file as File).size > 4 * 1024 * 1024) return { ok: false, error: "Certificate must be under 4 MB" };

  const ev = await evaluate(s, f, hasCertificate);
  const type = ev.typeRow;
  if (!type) return { ok: false, error: "Pick a leave type" };
  if (ev.check.errors.length) return { ok: false, error: ev.check.errors.join(". ") };
  if (ev.check.lopOffer && !convertToLop) {
    return { ok: false, error: `Not enough ${type.code} balance. ${ev.check.lopOffer.lopDays} day(s) can be converted to LOP.` };
  }

  let attachment_url: string | null = null;
  if (hasCertificate) {
    const fl = file as File;
    const path = `${s.employeeId}/${randomUUID()}-${fl.name.replace(/[^\w.-]+/g, "_")}`;
    const { error } = await db().storage.from("certificates").upload(path, fl, { contentType: fl.type || "application/octet-stream" });
    if (error) return { ok: false, error: `Certificate upload failed: ${error.message}` };
    attachment_url = path;
  }

  const lopType = (await leaveTypes()).find((t) => t.code === "LOP");
  const to = f.isHalfDay && type.half_day_allowed ? f.from : f.to;
  const rows: Record<string, unknown>[] = [];
  if (ev.check.lopOffer && convertToLop) {
    if (!lopType) return { ok: false, error: "LOP leave type is not configured" };
    if (f.isHalfDay) {
      rows.push({ leave_type_id: lopType.id, from_date: f.from, to_date: f.from, is_half_day: true, days: 0.5 });
    } else {
      const split = splitForLop(ev.count.countedDates, ev.check.lopOffer.typedDays);
      if (split.typed) rows.push({ leave_type_id: type.id, from_date: split.typed.from, to_date: split.typed.to, is_half_day: false, days: split.typed.days });
      if (split.lop) rows.push({ leave_type_id: lopType.id, from_date: split.lop.from, to_date: split.lop.to, is_half_day: false, days: split.lop.days });
    }
  } else {
    rows.push({ leave_type_id: type.id, from_date: f.from, to_date: to, is_half_day: f.isHalfDay && type.half_day_allowed, days: ev.count.days });
  }

  const inserted = must(
    await db().from("leave_requests").insert(rows.map((r) => ({ ...r, employee_id: s.employeeId, reason: f.reason, status: "pending", attachment_url }))).select("id, leave_type_id, from_date, to_date, days"),
    "submit leave",
  ) as { id: string; leave_type_id: string; from_date: string; to_date: string; days: number }[];

  const types = await leaveTypes();
  await notifyManager(s, inserted.map((r) => ({ code: types.find((t) => t.id === r.leave_type_id)?.code ?? "", from: r.from_date, to: r.to_date, days: Number(r.days) })), f.reason);
  revalidatePath("/leave");
  revalidatePath("/");
  return { ok: true, data: { ids: inserted.map((r) => r.id) }, message: `Submitted. Waiting for approval.${s.employee.reporting_manager_id ? " Your manager has been emailed." : ""}` };
}

/** L5 — cancel own pending leave, or approved leave that has not started. The DB function restores the balance. */
export async function cancelLeave(id: string): Promise<ActionResult> {
  const s = await requireSession();
  const req = must(await db().from("leave_requests").select("*").eq("id", id).maybeSingle(), "request") as LeaveRequest | null;
  if (!req || !canCancel(req, s.employeeId, s.today)) return { ok: false, error: "This leave can no longer be cancelled" };
  const { error } = await db().rpc("cancel_leave_request", { p_request: id, p_employee: s.employeeId, p_today: s.today });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/leave");
  revalidatePath("/");
  return { ok: true, message: req.status === "approved" ? "Cancelled. The days are back in your balance." : "Cancelled." };
}

/** L4 — approve or reject with a comment. Balance changes only on approval, inside the DB function. */
export async function decideLeave(id: string, approve: boolean, comment: string): Promise<ActionResult> {
  const s = await requireSession();
  const sb = db();
  const req = must(await sb.from("leave_requests").select("*").eq("id", id).maybeSingle(), "request") as LeaveRequest | null;
  if (!req) return { ok: false, error: "Request not found" };
  if (req.employee_id === s.employeeId) return { ok: false, error: "You cannot approve your own leave. It goes to your manager." };
  if (!canDecideFor(s, req.employee_id)) return { ok: false, error: "Only the employee's manager or HR can decide this" };
  if (req.status !== "pending") return { ok: false, error: "This request was already decided. Reload to see the latest." };
  if (!approve && (!comment || comment.trim().length < 2)) return { ok: false, error: "Add a comment when rejecting" };

  const emp = must(await sb.from("employees").select("*").eq("id", req.employee_id).single(), "employee") as Employee;
  if (approve) {
    const bal = await balanceFor(emp, req.leave_type_id, yearOf(req.from_date), s.today);
    if (!balanceAllowsApproval(bal?.available ?? null)) {
      return { ok: false, error: "Not approved — the balance changed since this was submitted. Ask the employee to convert the extra days to LOP." };
    }
  }
  const { error } = await sb.rpc("decide_leave_request", { p_request: id, p_approver: s.employeeId, p_approve: approve, p_comment: comment?.trim() || null });
  if (error) return { ok: false, error: error.message.includes("no longer pending") ? "This request was already decided. Reload to see the latest." : error.message };

  const types = await leaveTypes(false);
  const code = types.find((t) => t.id === req.leave_type_id)?.code ?? "Leave";
  const mail = leaveDecidedEmail(emp, s.employee.full_name, { code, from: req.from_date, to: req.to_date, days: Number(req.days) }, approve, comment?.trim() || null, appUrl("/leave"));
  await sendEmail(mail.to, mail.subject, mail.text);
  revalidatePath("/approvals");
  return { ok: true, message: approve ? `Approved. ${emp.full_name}'s balance is updated.` : "Rejected. Pending days released." };
}

/** Signed link for a medical certificate: applicant, their manager, or HR. */
export async function certificateLink(id: string): Promise<ActionResult<{ url: string }>> {
  const s = await requireSession();
  const req = must(await db().from("leave_requests").select("employee_id, attachment_url").eq("id", id).maybeSingle(), "request") as { employee_id: string; attachment_url: string | null } | null;
  if (!req?.attachment_url) return { ok: false, error: "No certificate" };
  if (req.employee_id !== s.employeeId && !canDecideFor(s, req.employee_id)) return { ok: false, error: "Not allowed" };
  const { data, error } = await db().storage.from("certificates").createSignedUrl(req.attachment_url, 300);
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create link" };
  return { ok: true, data: { url: data.signedUrl } };
}
