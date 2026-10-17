import { describe, expect, it } from "vitest";
import { computeDayStatus, isLate, lateLopDates, statusFromHours } from "@/lib/attendance/rules";
import { buildMonth } from "@/lib/attendance/month";
import { planCheckIn } from "@/lib/attendance/checkin";
import { istDateTimeToUtc } from "@/lib/dates";

const PANAJI = [0, 6];
const VERNA = [0];
const base = { today: "2026-10-17", joinDate: "2020-01-01", lastWorkingDay: null };
const punch = (date: string, inT: string, outT: string | null, wfh = false) => ({
  check_in: istDateTimeToUtc(date, inT).toISOString(),
  check_out: outT ? istDateTimeToUtc(date, outT).toISOString() : null,
  is_wfh: wfh,
});

describe("check-in", () => {
  it("checking in twice on the same day does not create a second record", () => {
    const now = istDateTimeToUtc("2026-10-16", "09:30");
    const first = planCheckIn(null, now, "2026-10-16", "2020-01-01", false);
    expect(first.kind).toBe("create");
    const second = planCheckIn({ check_in: now.toISOString() }, now, "2026-10-16", "2020-01-01", false);
    expect(second.kind).toBe("exists");
  });
  it("cannot check in before the joining date", () => {
    expect(planCheckIn(null, new Date(), "2026-10-16", "2026-11-01", false).kind).toBe("not-joined");
  });
  it("the check-in time is stored as an instant; Late is judged in IST", () => {
    const plan = planCheckIn(null, istDateTimeToUtc("2026-10-16", "10:20"), "2026-10-16", "2020-01-01", false);
    expect(plan.kind === "create" && plan.row.is_late).toBe(true);
  });
});

describe("Late rule", () => {
  it("10:20 IST is Late; 10:15 exactly is not", () => {
    expect(isLate(istDateTimeToUtc("2026-10-16", "10:20"))).toBe(true);
    expect(isLate(istDateTimeToUtc("2026-10-16", "10:15"))).toBe(false);
    expect(isLate(istDateTimeToUtc("2026-10-16", "10:15:01"))).toBe(true);
  });
  it("the third Late in a month creates a half-day LOP", () => {
    const days = ["2026-10-05", "2026-10-07", "2026-10-09", "2026-10-12"].map((date) => ({ date, late: true, status: "P" as const }));
    expect(lateLopDates(days.slice(0, 2))).toEqual([]);
    expect(lateLopDates(days)).toEqual(["2026-10-09"]);
  });
  it("month summary shows 0.5 LOP after 3 Lates", () => {
    const att = ["2026-10-05", "2026-10-06", "2026-10-07"].map((d) => ({ date: d, ...punch(d, "10:20", "19:00") }));
    const { summary, days } = buildMonth({ year: 2026, month: 10, ...base, weeklyOffDays: PANAJI, holidays: [], leaves: [], attendance: att });
    expect(summary.late).toBe(3);
    expect(summary.lateLopDays).toBe(0.5);
    expect(days.find((d) => d.date === "2026-10-07")!.lateLop).toBe(true);
  });
});

describe("hours to status", () => {
  it("5 hours worked is Half Day; 8 hours is Present", () => {
    expect(computeDayStatus({ ...base, date: "2026-10-16", weeklyOffDays: PANAJI, attendance: punch("2026-10-16", "09:00", "14:00") }).status).toBe("HD");
    expect(computeDayStatus({ ...base, date: "2026-10-16", weeklyOffDays: PANAJI, attendance: punch("2026-10-16", "09:00", "17:00") }).status).toBe("P");
  });
  it("under 4 hours or no punch is Absent; WFH with 8h counts as Present (WFH)", () => {
    expect(statusFromHours(3.9, false)).toBe("A");
    expect(computeDayStatus({ ...base, date: "2026-10-15", weeklyOffDays: PANAJI }).status).toBe("A");
    expect(statusFromHours(8, true)).toBe("WFH");
  });
  it("a missing check-out on a past day is Absent (missed punch); today it is in progress", () => {
    const past = computeDayStatus({ ...base, date: "2026-10-15", weeklyOffDays: PANAJI, attendance: punch("2026-10-15", "09:00", null) });
    expect(past.status).toBe("A");
    expect(past.missedPunch).toBe(true);
    const today = computeDayStatus({ ...base, today: "2026-10-16", date: "2026-10-16", weeklyOffDays: PANAJI, attendance: punch("2026-10-16", "09:00", null) });
    expect(today.inProgress).toBe(true);
  });
  it("approved leave is On Leave even if the employee punched in", () => {
    expect(computeDayStatus({ ...base, date: "2026-10-16", weeklyOffDays: PANAJI, leave: { code: "CL", isHalfDay: false }, attendance: punch("2026-10-16", "09:00", "18:00") }).status).toBe("L");
  });
});

describe("weekly offs and holidays per location", () => {
  it("a plant employee's Saturday is a working day; a head office employee's is a weekly off", () => {
    expect(computeDayStatus({ ...base, date: "2026-10-10", weeklyOffDays: VERNA }).status).toBe("A"); // Saturday, no punch
    expect(computeDayStatus({ ...base, date: "2026-10-10", weeklyOffDays: PANAJI }).status).toBe("WO");
    expect(computeDayStatus({ ...base, date: "2026-10-11", weeklyOffDays: VERNA }).status).toBe("WO"); // Sunday
  });
  it("a state holiday added for Verna does not appear for Panaji", () => {
    const vernaHolidays = [{ date: "2026-06-24", name: "Sao Joao", type: "State" }];
    const panajiHolidays: typeof vernaHolidays = [];
    const v = buildMonth({ year: 2026, month: 6, ...base, weeklyOffDays: VERNA, holidays: vernaHolidays, leaves: [], attendance: [] });
    const p = buildMonth({ year: 2026, month: 6, ...base, weeklyOffDays: PANAJI, holidays: panajiHolidays, leaves: [], attendance: [] });
    expect(v.days.find((d) => d.date === "2026-06-24")!.status).toBe("H");
    expect(p.days.find((d) => d.date === "2026-06-24")!.status).not.toBe("H");
  });
  it("an optional holiday is listed but stays a working day", () => {
    expect(computeDayStatus({ ...base, date: "2026-11-09", weeklyOffDays: PANAJI, holiday: { name: "Diwali", type: "Optional" } }).status).not.toBe("H");
  });
  it("days before joining or after the last working day are not counted", () => {
    expect(computeDayStatus({ ...base, joinDate: "2026-10-20", date: "2026-10-16", weeklyOffDays: PANAJI }).status).toBe("NONE");
  });
});

describe("month calendar", () => {
  it("working-day leave does not cover a weekend inside the range; every day has exactly one status", () => {
    const { days, summary } = buildMonth({
      year: 2026, month: 10, ...base, weeklyOffDays: PANAJI, holidays: [{ date: "2026-10-02", name: "Gandhi Jayanti", type: "National" }],
      leaves: [{ from_date: "2026-10-09", to_date: "2026-10-12", is_half_day: false, code: "CL", count_calendar_days: false }], attendance: [],
    });
    expect(days.find((d) => d.date === "2026-10-10")!.status).toBe("WO");
    expect(summary.leaveDaysByCode.CL).toBe(2);
    const total = summary.present + summary.wfh + summary.halfDay + summary.absent + summary.leave + summary.holiday + summary.weeklyOff + summary.notApplicable;
    expect(total).toBe(31);
  });
});
