import { describe, expect, it } from "vitest";
import { accessDecision, canDecideFor, canManageEmployee, canViewEmployee, deriveDirectReports, type Actor } from "@/lib/auth/rules";

const today = "2026-10-17";
const staff = [
  { id: "mgr", reporting_manager_id: null, last_working_day: null },
  { id: "a", reporting_manager_id: "mgr", last_working_day: null },
  { id: "b", reporting_manager_id: "mgr", last_working_day: "2026-09-30" }, // exited
  { id: "c", reporting_manager_id: "a", last_working_day: null },
];

describe("login and roles", () => {
  it("a deactivated employee cannot log in after the last working day", () => {
    expect(accessDecision({ last_working_day: "2026-10-16" }, today)).toEqual({ ok: false, reason: "exited" });
  });
  it("can still log in on the last working day itself", () => {
    expect(accessDecision({ last_working_day: "2026-10-17" }, today)).toEqual({ ok: true });
  });
  it("an unknown email is denied", () => {
    expect(accessDecision(null, today)).toEqual({ ok: false, reason: "unknown" });
  });
  it("manager is derived from active direct reports only", () => {
    expect(deriveDirectReports("mgr", staff, today)).toEqual(["a"]);
    expect(deriveDirectReports("a", staff, today)).toEqual(["c"]);
    expect(deriveDirectReports("c", staff, today)).toEqual([]);
  });
});

describe("access checks", () => {
  const employee: Actor = { employeeId: "c", isHr: false, isManager: false, directReportIds: [] };
  const manager: Actor = { employeeId: "mgr", isHr: false, isManager: true, directReportIds: ["a"] };
  const hr: Actor = { employeeId: "hr", isHr: true, isManager: false, directReportIds: [] };

  it("employee cannot open another employee's profile by changing the URL", () => {
    expect(canViewEmployee(employee, "a")).toBe(false);
    expect(canViewEmployee(employee, "c")).toBe(true);
  });
  it("HR can view any profile", () => {
    expect(canViewEmployee(hr, "a")).toBe(true);
  });
  it("manager sees only direct reports' team data", () => {
    expect(canManageEmployee(manager, "a")).toBe(true);
    expect(canManageEmployee(manager, "c")).toBe(false);
  });
  it("nobody approves their own request, not even HR", () => {
    expect(canDecideFor(manager, "mgr")).toBe(false);
    expect(canDecideFor(hr, "hr")).toBe(false);
    expect(canDecideFor(hr, "a")).toBe(true);
  });
});
