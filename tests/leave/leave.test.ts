import { describe, expect, it } from "vitest";
import { countLeaveDays } from "@/lib/leave/workingDays";
import { accruedFor, completedMonthsInYear, computeBalance, carryForward, proRataMonths } from "@/lib/leave/balance";
import { balanceAllowsApproval, canCancel, splitForLop, validateLeaveApplication } from "@/lib/leave/rules";

const PANAJI = [0, 6];
const VERNA = [0];
const CL = { code: "CL", annual_quota: 8, accrual_method: "annual_prorated" as const, half_day_allowed: true, requires_certificate_after_days: null, gender_restriction: null, is_active: true };
const SL = { ...CL, code: "SL", annual_quota: 7, requires_certificate_after_days: 2 };
const EL = { code: "EL", annual_quota: 15, accrual_method: "monthly" as const, half_day_allowed: false, requires_certificate_after_days: null, gender_restriction: null, is_active: true };
const emp = { date_of_joining: "2020-01-01", last_working_day: null, gender: "Male" };
const today = "2026-10-17";

function check(over: Partial<Parameters<typeof validateLeaveApplication>[0]> & { from: string; to: string }) {
  const count = countLeaveDays({ from: over.from, to: over.to, weeklyOffDays: PANAJI, holidays: [], isHalfDay: over.isHalfDay });
  return validateLeaveApplication({ type: CL, isHalfDay: false, reason: "Family function", hasCertificate: false, today, employee: emp, count, available: 8, overlapsExisting: false, ...over });
}

describe("working-day count", () => {
  it("Friday to Monday at head office counts 2 days, not 4", () => {
    const r = countLeaveDays({ from: "2026-10-23", to: "2026-10-26", weeklyOffDays: PANAJI, holidays: [] });
    expect(r.days).toBe(2);
    expect(r.skipped.map((s) => s.reason)).toEqual(["Weekly off", "Weekly off"]);
  });
  it("the same Friday to Monday at the plant counts 3 (Saturday is a working day)", () => {
    expect(countLeaveDays({ from: "2026-10-23", to: "2026-10-26", weeklyOffDays: VERNA, holidays: [] }).days).toBe(3);
  });
  it("holidays inside the range are skipped; optional holidays are counted", () => {
    const r = countLeaveDays({ from: "2026-09-30", to: "2026-10-02", weeklyOffDays: PANAJI, holidays: [{ date: "2026-10-02", name: "Gandhi Jayanti", type: "National" }] });
    expect(r.days).toBe(2);
    expect(countLeaveDays({ from: "2026-11-09", to: "2026-11-09", weeklyOffDays: PANAJI, holidays: [{ date: "2026-11-09", name: "Diwali", type: "Optional" }] }).days).toBe(1);
  });
  it("half day is 0.5; maternity counts calendar days", () => {
    expect(countLeaveDays({ from: "2026-10-23", to: "2026-10-23", weeklyOffDays: PANAJI, holidays: [], isHalfDay: true }).days).toBe(0.5);
    expect(countLeaveDays({ from: "2026-10-23", to: "2026-10-26", weeklyOffDays: PANAJI, holidays: [], countCalendarDays: true }).days).toBe(4);
  });
});

describe("accrual and pro-rating", () => {
  it("an employee who joined on 1 July sees pro-rated CL and SL", () => {
    expect(proRataMonths("2026-07-01", 2026)).toBe(6);
    expect(accruedFor(CL, { date_of_joining: "2026-07-01" }, 2026, today)).toBe(4);
    expect(accruedFor(SL, { date_of_joining: "2026-07-01" }, 2026, today)).toBe(3.5);
  });
  it("joined after the 15th: credit starts next month", () => {
    expect(proRataMonths("2026-07-20", 2026)).toBe(5);
  });
  it("full year for an earlier joiner", () => {
    expect(accruedFor(CL, { date_of_joining: "2019-03-10" }, 2026, today)).toBe(8);
  });
  it("EL is 1.25 per completed month", () => {
    expect(completedMonthsInYear("2019-03-10", 2026, "2026-10-17")).toBe(9);
    expect(accruedFor(EL, { date_of_joining: "2019-03-10" }, 2026, "2026-10-17")).toBe(11.25);
    expect(accruedFor(EL, { date_of_joining: "2026-07-01" }, 2026, "2026-10-17")).toBe(3.75);
    expect(accruedFor(EL, { date_of_joining: "2019-03-10" }, 2025, "2026-10-17")).toBe(15);
  });
  it("available = opening + accrued − used − pending", () => {
    expect(computeBalance(5, 11.25, 2, 1).available).toBe(13.25);
    expect(computeBalance(0, null, 3, 0).available).toBeNull(); // LOP unlimited
  });
  it("EL carries forward up to 30; nothing negative", () => {
    expect(carryForward(34, 30)).toBe(30);
    expect(carryForward(6, 0)).toBe(0);
  });
});

describe("apply rules", () => {
  it("a valid request passes", () => {
    expect(check({ from: "2026-10-23", to: "2026-10-26" }).ok).toBe(true);
  });
  it("applying for more CL than available offers conversion to LOP", () => {
    const r = check({ from: "2026-10-19", to: "2026-10-23", available: 3 });
    expect(r.ok).toBe(false);
    expect(r.lopOffer).toEqual({ typedDays: 3, lopDays: 2 });
    const count = countLeaveDays({ from: "2026-10-19", to: "2026-10-23", weeklyOffDays: PANAJI, holidays: [] });
    expect(splitForLop(count.countedDates, 3)).toEqual({
      typed: { from: "2026-10-19", to: "2026-10-21", days: 3 },
      lop: { from: "2026-10-22", to: "2026-10-23", days: 2 },
    });
  });
  it("SL of 3 days cannot be submitted without a certificate", () => {
    const r = check({ type: SL, from: "2026-10-19", to: "2026-10-21" });
    expect(r.ok).toBe(false);
    expect(r.needsCertificate).toBe(true);
    expect(check({ type: SL, from: "2026-10-19", to: "2026-10-21", hasCertificate: true }).ok).toBe(true);
    expect(check({ type: SL, from: "2026-10-19", to: "2026-10-20" }).needsCertificate).toBe(false);
  });
  it("no leave more than 30 days in the past", () => {
    expect(check({ from: "2026-09-10", to: "2026-09-10" }).errors.join()).toMatch(/30 days/);
    expect(check({ from: "2026-09-17", to: "2026-09-17" }).ok).toBe(true);
  });
  it("EL cannot be a half day; half day must be one date", () => {
    expect(check({ type: EL, from: "2026-10-23", to: "2026-10-23", isHalfDay: true }).ok).toBe(false);
    expect(check({ from: "2026-10-22", to: "2026-10-23", isHalfDay: true }).ok).toBe(false);
  });
  it("a range with only weekly offs is rejected; requests stay in one year", () => {
    expect(check({ from: "2026-10-24", to: "2026-10-25" }).ok).toBe(false);
    expect(check({ from: "2026-12-31", to: "2027-01-01" }).ok).toBe(false);
  });
  it("overlapping an existing request is rejected", () => {
    expect(check({ from: "2026-10-23", to: "2026-10-23", overlapsExisting: true }).ok).toBe(false);
  });
});

describe("cancel and approve", () => {
  it("cancel pending, or approved future leave; not started/past approved leave", () => {
    expect(canCancel({ employee_id: "me", status: "pending", from_date: "2026-10-01" }, "me", today)).toBe(true);
    expect(canCancel({ employee_id: "me", status: "approved", from_date: "2026-10-20" }, "me", today)).toBe(true);
    expect(canCancel({ employee_id: "me", status: "approved", from_date: "2026-10-17" }, "me", today)).toBe(false);
    expect(canCancel({ employee_id: "other", status: "pending", from_date: "2026-10-20" }, "me", today)).toBe(false);
  });
  it("approval is blocked if the balance went negative since applying", () => {
    expect(balanceAllowsApproval(0)).toBe(true);
    expect(balanceAllowsApproval(-1)).toBe(false);
    expect(balanceAllowsApproval(null)).toBe(true);
  });
  it("balance does not change while pending (pending held), changes on approval, restored on cancel", () => {
    // pending: used 0, pending 2 → available 6 (used unchanged)
    const pendingState = computeBalance(0, 8, 0, 2);
    expect(pendingState.used).toBe(0);
    expect(pendingState.available).toBe(6);
    // approved: pending → used
    expect(computeBalance(0, 8, 2, 0).available).toBe(6);
    expect(computeBalance(0, 8, 2, 0).used).toBe(2);
    // cancelled approved future leave: used restored
    expect(computeBalance(0, 8, 0, 0).available).toBe(8);
  });
});
