import { describe, expect, it } from "vitest";
import { leaveDecidedEmail, leaveRequestedEmail } from "@/lib/email/templates";

describe("leave emails", () => {
  it("the manager receives an email on a new request", () => {
    const m = leaveRequestedEmail({ email: "sunil@x.com", full_name: "Sunil Gaonkar" }, { full_name: "Ravi Shetty", employee_code: "KCF0010" },
      [{ code: "CL", from: "2026-10-23", to: "2026-10-26", days: 2 }], "Village feast", "https://app/approvals");
    expect(m.to).toBe("sunil@x.com");
    expect(m.subject).toContain("Ravi Shetty");
    expect(m.text).toContain("2 days");
    expect(m.text).toContain("https://app/approvals");
  });
  it("the employee receives an email on the decision", () => {
    const m = leaveDecidedEmail({ email: "ravi@x.com", full_name: "Ravi Shetty" }, "Sunil Gaonkar", { code: "CL", from: "2026-10-23", to: "2026-10-26", days: 2 }, false, "Audit week", "https://app/leave");
    expect(m.to).toBe("ravi@x.com");
    expect(m.subject).toBe("Your CL request was rejected");
    expect(m.text).toContain("Audit week");
  });
});
