import { describe, expect, it } from "vitest";
import { isAtLeast18On, validateEmployee, validateContact, MESSAGES, type EmployeeInput } from "@/lib/employees/validation";
import { maskAadhaar, maskAccount, maskPan } from "@/lib/employees/mask";
import { createsReportingLoop } from "@/lib/employees/reporting";

const valid: EmployeeInput = {
  full_name: "Ravi Shetty", email: "Ravi@Example.com", mobile: "9876543210", dob: "1990-10-10", gender: "Male",
  address_line: "12 Verna", city: "Verna", state: "Goa", pin_code: "403722",
  date_of_joining: "2026-01-05", designation: "Supervisor", grade: "S2", department_id: "d", location_id: "l",
  reporting_manager_id: "", is_hr_admin: false,
  pan: "ABCDE1234F", aadhaar: "123412341234", uan: "", account_number: "123456789012", ifsc: "HDFC0001234", bank_name: "HDFC",
  emergency_name: "Anita", emergency_relation: "Mother", emergency_mobile: "9123456780",
};

describe("employee validation", () => {
  it("accepts a valid employee (UAN optional for a new joiner)", () => {
    expect(validateEmployee(valid)).toEqual({});
  });
  it("rejects an invalid PAN like ABC123 with a clear message", () => {
    expect(validateEmployee({ ...valid, pan: "ABC123" }).pan).toBe(MESSAGES.pan);
  });
  it("accepts lower-case PAN with spaces after normalising", () => {
    expect(validateEmployee({ ...valid, pan: "abcde 1234 f" }).pan).toBeUndefined();
  });
  it("rejects an invalid IFSC", () => {
    expect(validateEmployee({ ...valid, ifsc: "HDFC1234567" }).ifsc).toBe(MESSAGES.ifsc);
    expect(validateEmployee({ ...valid, ifsc: "HDF0001234" }).ifsc).toBe(MESSAGES.ifsc);
  });
  it("rejects a 9-digit mobile and one starting with 5", () => {
    expect(validateEmployee({ ...valid, mobile: "987654321" }).mobile).toBe(MESSAGES.mobile);
    expect(validateEmployee({ ...valid, mobile: "5876543210" }).mobile).toBe(MESSAGES.mobile);
  });
  it("Aadhaar must be 12 digits, UAN 12 digits when given", () => {
    expect(validateEmployee({ ...valid, aadhaar: "12341234123" }).aadhaar).toBe(MESSAGES.aadhaar);
    expect(validateEmployee({ ...valid, uan: "12345" }).uan).toBe(MESSAGES.uan);
    expect(validateEmployee({ ...valid, uan: "100900000001" }).uan).toBeUndefined();
  });
  it("PIN 6 digits; state from the list", () => {
    expect(validateEmployee({ ...valid, pin_code: "40372" }).pin_code).toBe(MESSAGES.pin);
    expect(validateEmployee({ ...valid, state: "Goa State" }).state).toBe(MESSAGES.state);
  });
  it("an employee aged 17 on the joining date is rejected", () => {
    expect(validateEmployee({ ...valid, dob: "2008-06-01", date_of_joining: "2026-01-05" }).dob).toBe(MESSAGES.age);
  });
  it("turning 18 exactly on the joining date is allowed", () => {
    expect(isAtLeast18On("2008-01-05", "2026-01-05")).toBe(true);
    expect(isAtLeast18On("2008-01-06", "2026-01-05")).toBe(false);
  });
  it("in edit mode blank statutory fields mean keep current", () => {
    expect(validateEmployee({ ...valid, pan: "", aadhaar: "", account_number: "", ifsc: "", bank_name: "" }, "edit")).toEqual({});
  });
  it("self-service contact edit validates mobile and PIN", () => {
    expect(validateContact({ mobile: "12345", address_line: "x", city: "y", state: "Goa", pin_code: "403001", emergency_name: "a", emergency_relation: "b", emergency_mobile: "9123456780" }).mobile).toBe(MESSAGES.mobile);
  });
});

describe("masking", () => {
  it("PAN shows as ABCDE****F", () => expect(maskPan("ABCDE1234F")).toBe("ABCDE****F"));
  it("Aadhaar shows as XXXX XXXX 1234", () => expect(maskAadhaar("987654321234")).toBe("XXXX XXXX 1234"));
  it("bank account shows last 4 digits only", () => {
    const m = maskAccount("50100012345678");
    expect(m.endsWith("5678")).toBe(true);
    expect(m).not.toMatch(/1234/);
  });
});

describe("reporting structure", () => {
  const managerOf = new Map<string, string | null>([["A", null], ["B", "A"], ["C", "B"]]);
  it("an employee cannot report to themselves", () => {
    expect(createsReportingLoop("A", "A", managerOf)).toBe(true);
  });
  it("setting A's manager to B when B reports to A is blocked", () => {
    expect(createsReportingLoop("A", "B", managerOf)).toBe(true);
    expect(createsReportingLoop("A", "C", managerOf)).toBe(true); // indirect
  });
  it("a normal change is allowed", () => {
    expect(createsReportingLoop("C", "A", managerOf)).toBe(false);
  });
});
