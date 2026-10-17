"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireHr } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { isValidISODate } from "@/lib/dates";
import type { ActionResult } from "@/lib/types";

const done = (message: string): ActionResult => {
  revalidatePath("/settings");
  return { ok: true, message };
};

/** A7 — HR adds a holiday for one location, typed National / State / Optional. */
export async function addHoliday(locationIds: string[], date: string, name: string, type: string): Promise<ActionResult> {
  const s = await requireHr();
  if (!locationIds.length) return { ok: false, error: "Pick at least one location" };
  if (!isValidISODate(date)) return { ok: false, error: "Pick a date" };
  if (!name.trim()) return { ok: false, error: "Enter the holiday name" };
  if (!["National", "State", "Optional"].includes(type)) return { ok: false, error: "Pick National, State or Optional" };
  const { error } = await db().from("holidays").insert(locationIds.map((location_id) => ({ location_id, date, name: name.trim(), type })));
  if (error) return { ok: false, error: error.message.includes("holidays_location_id_date_key") ? "That location already has a holiday on this date" : error.message };
  await writeAudit(locationIds.map((id) => ({ table_name: "holidays", record_id: id, field: "holiday", new_value: `${date} ${name} (${type})`, action: "create" as const, changed_by: s.employeeId })));
  return done("Holiday added");
}

export async function deleteHoliday(id: string): Promise<ActionResult> {
  const s = await requireHr();
  const { data, error } = await db().from("holidays").delete().eq("id", id).select("*").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (data) await writeAudit([{ table_name: "holidays", record_id: data.location_id, field: "holiday", old_value: `${data.date} ${data.name} (${data.type})`, new_value: null, changed_by: s.employeeId }]);
  return done("Holiday removed");
}

export async function updateWeeklyOffs(locationId: string, days: number[]): Promise<ActionResult> {
  const s = await requireHr();
  const clean = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (clean.length === 0 || clean.length > 3) return { ok: false, error: "Pick one to three weekly off days" };
  const { data: before } = await db().from("locations").select("weekly_off_days").eq("id", locationId).single();
  const { error } = await db().from("locations").update({ weekly_off_days: clean }).eq("id", locationId);
  if (error) return { ok: false, error: error.message };
  await writeAudit([{ table_name: "locations", record_id: locationId, field: "weekly_off_days", old_value: JSON.stringify(before?.weekly_off_days ?? []), new_value: JSON.stringify(clean), changed_by: s.employeeId }]);
  return done("Weekly offs saved");
}

export async function addLocation(name: string, city: string, state: string, days: number[]): Promise<ActionResult> {
  await requireHr();
  if (!name.trim() || !city.trim() || !state.trim()) return { ok: false, error: "Name, city and state are required" };
  const { error } = await db().from("locations").insert({ name: name.trim(), city: city.trim(), state: state.trim(), weekly_off_days: days.length ? days : [0] });
  if (error) return { ok: false, error: error.message };
  return done("Location added");
}

export async function addDepartment(name: string): Promise<ActionResult> {
  await requireHr();
  if (!name.trim()) return { ok: false, error: "Enter a department name" };
  const { error } = await db().from("departments").insert({ name: name.trim() });
  if (error) return { ok: false, error: error.message.includes("unique") ? "That department already exists" : error.message };
  return done("Department added");
}

export type LeaveTypeInput = {
  id?: string; code: string; name: string; annual_quota: string; accrual_method: string; carry_forward_max: string;
  half_day_allowed: boolean; requires_certificate_after_days: string; count_calendar_days: boolean; gender_restriction: string; is_active: boolean;
};

/** L1 — HR configures leave types: quota, accrual method, carry-forward limit, half day allowed. */
export async function saveLeaveType(v: LeaveTypeInput): Promise<ActionResult> {
  const s = await requireHr();
  const code = v.code.trim().toUpperCase();
  if (!/^[A-Z]{2,5}$/.test(code)) return { ok: false, error: "Code must be 2–5 capital letters" };
  if (!v.name.trim()) return { ok: false, error: "Enter a name" };
  if (!["annual_prorated", "monthly", "on_request", "none"].includes(v.accrual_method)) return { ok: false, error: "Pick an accrual method" };
  const num = (x: string) => (x === "" ? null : Number(x));
  const quota = num(v.annual_quota);
  if (quota !== null && (Number.isNaN(quota) || quota < 0)) return { ok: false, error: "Quota must be 0 or more (blank = unlimited)" };
  if (v.accrual_method !== "none" && quota === null) return { ok: false, error: "Only the 'none' accrual method can be unlimited" };
  const cf = Number(v.carry_forward_max || 0);
  if (Number.isNaN(cf) || cf < 0) return { ok: false, error: "Carry-forward limit must be 0 or more" };
  const row = {
    code, name: v.name.trim(), annual_quota: quota, accrual_method: v.accrual_method, carry_forward_max: cf,
    half_day_allowed: v.half_day_allowed, requires_certificate_after_days: num(v.requires_certificate_after_days),
    count_calendar_days: v.count_calendar_days, gender_restriction: v.gender_restriction || null, is_active: v.is_active,
  };
  const sb = db();
  const res = v.id ? await sb.from("leave_types").update(row).eq("id", v.id).select("id").single() : await sb.from("leave_types").insert(row).select("id").single();
  if (res.error) return { ok: false, error: res.error.message.includes("unique") ? "That code already exists" : res.error.message };
  await writeAudit([{ table_name: "leave_types", record_id: res.data.id, field: code, new_value: JSON.stringify(row), action: v.id ? "update" : "create", changed_by: s.employeeId }]);
  return done(`Leave type ${code} saved`);
}

export async function savePolicy(key: string, title: string, body: string): Promise<ActionResult> {
  await requireHr();
  if (!/^[a-z_]{2,30}$/.test(key)) return { ok: false, error: "Key must be lower-case letters" };
  if (body.trim().length < 20) return { ok: false, error: "Policy text is too short" };
  const { error } = await db().from("policy_documents").upsert({ key, title: title.trim() || key, body: body.trim(), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };
  return done("Policy text saved. Ask HR answers only from this text.");
}
