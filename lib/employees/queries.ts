import "server-only";
import { db, must } from "@/lib/db";
import { isActiveOn } from "@/lib/auth/rules";
import type { AuditEntry, Department, Employee, Location } from "@/lib/types";
import { maskAadhaar, maskAccount, maskPan, maskUan } from "./mask";

export async function loadOrgData() {
  const sb = db();
  const [emps, depts, locs] = await Promise.all([
    sb.from("employees").select("*").order("employee_code"),
    sb.from("departments").select("*").order("name"),
    sb.from("locations").select("*").order("name"),
  ]);
  return {
    employees: must(emps, "employees") as Employee[],
    departments: must(depts, "departments") as Department[],
    locations: must(locs, "locations") as Location[],
  };
}

export type DirectoryRow = Employee & { department: string; location: string; manager: string | null; active: boolean };

export async function listDirectory(
  filters: { q?: string; department?: string; location?: string; status?: string },
  today: string,
): Promise<{ rows: DirectoryRow[]; departments: Department[]; locations: Location[] }> {
  const { employees, departments, locations } = await loadOrgData();
  const byId = new Map(employees.map((e) => [e.id, e]));
  const q = (filters.q ?? "").trim().toLowerCase();
  const status = filters.status ?? "active";
  const rows = employees
    .map((e) => ({
      ...e,
      department: departments.find((d) => d.id === e.department_id)?.name ?? "—",
      location: locations.find((l) => l.id === e.location_id)?.name ?? "—",
      manager: e.reporting_manager_id ? byId.get(e.reporting_manager_id)?.full_name ?? null : null,
      active: isActiveOn(e, today),
    }))
    .filter((e) => !q || e.full_name.toLowerCase().includes(q) || e.employee_code.toLowerCase().includes(q) || e.email.includes(q))
    .filter((e) => !filters.department || e.department_id === filters.department)
    .filter((e) => !filters.location || e.location_id === filters.location)
    .filter((e) => status === "all" || (status === "active" ? e.active : !e.active));
  return { rows, departments, locations };
}

/** Profile with statutory and bank data masked here, on the server. Aadhaar never leaves masked form. */
export async function getProfile(id: string) {
  const sb = db();
  const emp = must(await sb.from("employees").select("*").eq("id", id).maybeSingle(), "employee") as Employee | null;
  if (!emp) return null;
  const [stat, bank, dept, loc, mgr] = await Promise.all([
    sb.from("employee_statutory").select("pan, aadhaar, uan").eq("employee_id", id).maybeSingle(),
    sb.from("employee_bank").select("account_number, ifsc, bank_name").eq("employee_id", id).maybeSingle(),
    sb.from("departments").select("*").eq("id", emp.department_id).single(),
    sb.from("locations").select("*").eq("id", emp.location_id).single(),
    emp.reporting_manager_id
      ? sb.from("employees").select("id, full_name, employee_code").eq("id", emp.reporting_manager_id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const s = must(stat, "statutory") as { pan: string; aadhaar: string; uan: string | null } | null;
  const b = must(bank, "bank") as { account_number: string; ifsc: string; bank_name: string } | null;
  return {
    employee: emp,
    department: must(dept, "department") as Department,
    location: must(loc, "location") as Location,
    manager: must(mgr, "manager") as { id: string; full_name: string; employee_code: string } | null,
    statutory: {
      pan: maskPan(s?.pan),
      aadhaar: maskAadhaar(s?.aadhaar),
      uan: maskUan(s?.uan),
    },
    bank: {
      account_number: maskAccount(b?.account_number),
      ifsc: b?.ifsc ?? "—",
      bank_name: b?.bank_name ?? "—",
    },
  };
}

export type Profile = NonNullable<Awaited<ReturnType<typeof getProfile>>>;

export async function getAuditTrail(recordId: string): Promise<(AuditEntry & { changed_by_name: string | null })[]> {
  const sb = db();
  const rows = must(
    await sb.from("audit_log").select("*").eq("record_id", recordId).order("changed_at", { ascending: false }).limit(100),
    "audit",
  ) as AuditEntry[];
  const ids = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))] as string[];
  const names = ids.length
    ? (must(await sb.from("employees").select("id, full_name").in("id", ids), "names") as { id: string; full_name: string }[])
    : [];
  return rows.map((r) => ({ ...r, changed_by_name: names.find((n) => n.id === r.changed_by)?.full_name ?? null }));
}
