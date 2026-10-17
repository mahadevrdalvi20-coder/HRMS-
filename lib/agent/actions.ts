"use server";

import { db, must } from "@/lib/db";
import { requireHr } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { writeAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/types";

/** HR confirms the reminder email drafted by flag_month_end_issues. Only HR, only after a click. */
export async function sendReminderDraft(codes: string[], subject: string, body: string): Promise<ActionResult> {
  const s = await requireHr();
  if (!codes.length) return { ok: false, error: "No recipients" };
  const emps = must(await db().from("employees").select("id, email, full_name, employee_code").in("employee_code", codes.slice(0, 200)), "recipients") as { id: string; email: string; full_name: string; employee_code: string }[];
  for (const e of emps) await sendEmail(e.email, subject.slice(0, 200), body.slice(0, 4000));
  await writeAudit(emps.map((e) => ({ table_name: "employees", record_id: e.id, field: "reminder_email", new_value: subject.slice(0, 200), action: "update" as const, changed_by: s.employeeId })));
  return { ok: true, message: `Reminder sent to ${emps.length} employee(s).` };
}
