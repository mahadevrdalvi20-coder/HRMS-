import "server-only";
import { db } from "@/lib/db";

export type AuditInput = {
  table_name: string;
  record_id: string;
  field: string;
  old_value?: string | null;
  new_value?: string | null;
  action?: "create" | "update" | "reveal" | "deactivate" | "correct";
  reason?: string | null;
  changed_by: string;
};

export async function writeAudit(entries: AuditInput[]) {
  if (entries.length === 0) return;
  const { error } = await db().from("audit_log").insert(
    entries.map((e) => ({ ...e, old_value: e.old_value ?? null, new_value: e.new_value ?? null, action: e.action ?? "update" })),
  );
  if (error) throw new Error(`audit log: ${error.message}`);
}
