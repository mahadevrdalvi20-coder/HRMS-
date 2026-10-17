import { describe, expect, it } from "vitest";
import { buildMonth } from "@/lib/attendance/month";
import { csvColumns, summaryRow, toCsv } from "@/lib/reports/summary";
import { istDateTimeToUtc, eachDate, dayOfWeek } from "@/lib/dates";

const punch = (date: string, inT: string, outT: string | null, wfh = false) => ({
  date, check_in: istDateTimeToUtc(date, inT).toISOString(), check_out: outT ? istDateTimeToUtc(date, outT).toISOString() : null, is_wfh: wfh,
});

function sample(name: string, weeklyOff: number[], extra: Partial<Parameters<typeof buildMonth>[0]>) {
  const workdays = eachDate("2026-09-01", "2026-09-30").filter((d) => !weeklyOff.includes(dayOfWeek(d)));
  const m = buildMonth({
    year: 2026, month: 9, today: "2026-10-17", joinDate: "2020-01-01", lastWorkingDay: null, weeklyOffDays: weeklyOff,
    holidays: [{ date: "2026-09-14", name: "Ganesh Chaturthi", type: "State" }],
    leaves: [], attendance: workdays.filter((d) => d !== "2026-09-14").map((d) => punch(d, "09:30", "18:30")), ...extra,
  });
  return { m, row: summaryRow({ employee_code: name, full_name: name }, "Loc", "Dept", m.days, m.summary) };
}

describe("month-end summary", () => {
  const a = sample("KCF0001", [0, 6], {}); // clean month, head office
  const b = sample("KCF0002", [0], { // plant, with leave, LOP, half day, absent, lates, WFH
    leaves: [
      { from_date: "2026-09-07", to_date: "2026-09-08", is_half_day: false, code: "CL", count_calendar_days: false },
      { from_date: "2026-09-21", to_date: "2026-09-21", is_half_day: false, code: "LOP", count_calendar_days: false },
    ],
    attendance: [
      punch("2026-09-01", "10:20", "19:00"), punch("2026-09-02", "10:25", "19:00"), punch("2026-09-03", "10:30", "19:00"),
      punch("2026-09-04", "09:00", "14:00"), punch("2026-09-05", "09:00", "18:00", true), punch("2026-09-09", "09:00", null),
    ],
  });
  const c = sample("KCF0003", [0, 6], { joinDate: "2026-09-16" }); // mid-month joiner

  it("CSV totals match the calendar for three sample employees", () => {
    for (const { m, row } of [a, b, c]) {
      const count = (s: string) => m.days.filter((d) => d.status === s).length;
      expect(row.days_present).toBe(count("P") + count("HD") * 0.5);
      expect(row.wfh_days).toBe(count("WFH"));
      expect(row.absent_days).toBe(count("A"));
      expect(row.holidays).toBe(count("H"));
      expect(row.weekly_offs).toBe(count("WO"));
      expect(row.adds_up).toBe(true);
    }
    expect(b.row.leave.CL).toBe(2);
    expect(b.row.lop_leave_days).toBe(1);
    expect(b.row.late_marks).toBe(3);
    expect(b.row.late_lop_days).toBe(0.5);
    expect(b.row.half_days).toBe(1);
    expect(b.row.unresolved).toBe(1); // 9 Sep missed check-out
    expect(b.row.lop_days).toBe(1 + b.row.absent_days + 0.5 + 0.5);
    expect(c.row.not_employed_days).toBe(15);
    // Parse the CSV back and compare with the rows.
    const csv = toCsv([a.row, b.row, c.row], ["CL", "SL", "EL", "LOP"]);
    const [head, ...lines] = csv.trim().split("\n");
    const cols = head.split(",");
    const rowB = Object.fromEntries(lines[1].split(",").map((v, i) => [cols[i], v]));
    expect(Number(rowB.leave_CL)).toBe(2);
    expect(Number(rowB.days_present)).toBe(b.row.days_present);
    expect(Number(rowB.lop_days)).toBe(b.row.lop_days);
  });

  it("no PAN, Aadhaar or bank numbers in the CSV", () => {
    const cols = csvColumns(["CL", "SL"]);
    expect(cols.join(",")).not.toMatch(/pan|aadhaar|uan|account|ifsc|bank/i);
    expect(toCsv([a.row], ["CL"])).not.toMatch(/\d{12}/);
  });
});
