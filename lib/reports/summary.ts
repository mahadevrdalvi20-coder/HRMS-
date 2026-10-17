/**
 * L8 — month-end attendance summary for the payroll vendor. Pure functions.
 * Built from the same buildMonth() result as the calendar, so they always match.
 * The CSV never contains PAN, Aadhaar, UAN or bank numbers.
 */
import type { MonthDay, MonthSummary } from "@/lib/attendance/month";

export type SummaryRow = {
  employee_code: string;
  name: string;
  location: string;
  department: string;
  days_in_month: number;
  days_present: number; // Present + ½ × Half Day
  wfh_days: number;
  half_days: number;
  absent_days: number;
  leave: Record<string, number>; // by leave code, excluding LOP
  lop_leave_days: number;
  late_marks: number;
  late_lop_days: number;
  lop_days: number; // LOP leave + absent + ½ × half days + late LOP
  holidays: number;
  weekly_offs: number;
  not_employed_days: number;
  adds_up: boolean;
  unresolved: number; // absent days with a punch but no check-out (missed punch)
};

export function summaryRow(
  emp: { employee_code: string; full_name: string },
  location: string,
  department: string,
  days: MonthDay[],
  s: MonthSummary,
): SummaryRow {
  const leave: Record<string, number> = {};
  for (const [code, n] of Object.entries(s.leaveDaysByCode)) if (code !== "LOP") leave[code] = n;
  const lopLeave = s.leaveDaysByCode.LOP ?? 0;
  const statusDays = s.present + s.wfh + s.halfDay + s.absent + s.leave + s.holiday + s.weeklyOff + s.notApplicable;
  return {
    employee_code: emp.employee_code,
    name: emp.full_name,
    location,
    department,
    days_in_month: days.length,
    days_present: s.present + s.halfDay * 0.5,
    wfh_days: s.wfh,
    half_days: s.halfDay,
    absent_days: s.absent,
    leave,
    lop_leave_days: lopLeave,
    late_marks: s.late,
    late_lop_days: s.lateLopDays,
    lop_days: lopLeave + s.absent + s.halfDay * 0.5 + s.lateLopDays,
    holidays: s.holiday,
    weekly_offs: s.weeklyOff,
    not_employed_days: s.notApplicable,
    adds_up: statusDays === days.length,
    unresolved: s.missedPunches,
  };
}

const SENSITIVE = /pan|aadhaar|uan|account|ifsc|bank/i;

export function csvColumns(leaveCodes: string[]): string[] {
  const cols = [
    "employee_code", "name", "location", "department", "days_in_month", "days_present", "wfh_days", "half_days", "absent_days",
    ...leaveCodes.filter((c) => c !== "LOP").map((c) => `leave_${c}`),
    "lop_leave_days", "late_marks", "late_lop_days", "lop_days", "holidays", "weekly_offs", "not_employed_days",
  ];
  if (cols.some((c) => SENSITIVE.test(c))) throw new Error("Sensitive column in CSV");
  return cols;
}

function esc(v: unknown): string {
  const s = String(v ?? "");
  // Neutralise spreadsheet formulas and quote when needed.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: SummaryRow[], leaveCodes: string[]): string {
  const cols = csvColumns(leaveCodes);
  const lines = [cols.join(",")];
  for (const r of rows) {
    lines.push(
      cols
        .map((c) => (c.startsWith("leave_") ? r.leave[c.slice(6)] ?? 0 : (r as unknown as Record<string, unknown>)[c]))
        .map(esc)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}
