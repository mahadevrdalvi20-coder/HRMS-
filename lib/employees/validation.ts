/**
 * Indian field validation. Pure functions shared by the browser (instant feedback)
 * and the server actions (the real check). See RESEARCH.md §9 and CLAUDE.md.
 */
import { addYears, isValidISODate } from "@/lib/dates";

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const AADHAAR_RE = /^[0-9]{12}$/;
export const UAN_RE = /^[0-9]{12}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const MOBILE_RE = /^[6-9][0-9]{9}$/;
export const PIN_RE = /^[0-9]{6}$/;
export const ACCOUNT_RE = /^[0-9]{9,18}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  // Union territories
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;

export const MESSAGES = {
  pan: "Use 5 letters, 4 digits, 1 letter, e.g. ABCDE1234F",
  aadhaar: "Aadhaar must be exactly 12 digits",
  uan: "UAN must be exactly 12 digits (leave blank for a new joiner without one)",
  ifsc: "Use 4 letters, then 0, then 6 letters or digits, e.g. HDFC0001234",
  mobile: "Use a 10-digit mobile number starting with 6, 7, 8 or 9",
  pin: "PIN code must be exactly 6 digits",
  state: "Pick a state or union territory from the list",
  account: "Account number must be 9 to 18 digits",
  age: "Employee must be at least 18 years old on the joining date",
  email: "Enter a valid email address",
} as const;

export function isAtLeast18On(dob: string, onDate: string): boolean {
  if (!isValidISODate(dob) || !isValidISODate(onDate)) return false;
  return addYears(dob, 18) <= onDate;
}

/** Remove spaces and fix case so "abcde 1234 f" or "1234 5678 9012" are accepted. */
export function normaliseIds<T extends Record<string, unknown>>(v: T): T {
  const out: Record<string, unknown> = { ...v };
  const up = (k: string) => typeof out[k] === "string" && (out[k] = (out[k] as string).replace(/\s+/g, "").toUpperCase());
  const digits = (k: string) => typeof out[k] === "string" && (out[k] = (out[k] as string).replace(/[\s-]+/g, ""));
  up("pan"); up("ifsc");
  digits("aadhaar"); digits("uan"); digits("account_number"); digits("mobile"); digits("emergency_mobile"); digits("pin_code");
  if (typeof out.email === "string") out.email = (out.email as string).trim().toLowerCase();
  for (const k of Object.keys(out)) if (typeof out[k] === "string") out[k] = (out[k] as string).trim();
  return out as T;
}

export type EmployeeInput = {
  // personal
  full_name: string; email: string; mobile: string; dob: string; gender: string;
  address_line: string; city: string; state: string; pin_code: string;
  // job
  date_of_joining: string; designation: string; grade: string; department_id: string; location_id: string;
  reporting_manager_id: string; is_hr_admin: boolean;
  // statutory & bank (optional in edit mode: blank = keep current)
  pan: string; aadhaar: string; uan: string; account_number: string; ifsc: string; bank_name: string;
  // emergency
  emergency_name: string; emergency_relation: string; emergency_mobile: string;
};

/** Blank form values (shared by server pages and the client form). */
export const EMPTY_EMPLOYEE: EmployeeInput = {
  full_name: "", email: "", mobile: "", dob: "", gender: "", address_line: "", city: "", state: "Goa", pin_code: "",
  date_of_joining: "", designation: "", grade: "", department_id: "", location_id: "", reporting_manager_id: "", is_hr_admin: false,
  pan: "", aadhaar: "", uan: "", account_number: "", ifsc: "", bank_name: "",
  emergency_name: "", emergency_relation: "", emergency_mobile: "",
};

export const STEP_FIELDS: Record<"personal" | "job" | "statutory" | "emergency", (keyof EmployeeInput)[]> = {
  personal: ["full_name", "email", "mobile", "dob", "gender", "address_line", "city", "state", "pin_code"],
  job: ["date_of_joining", "designation", "grade", "department_id", "location_id", "reporting_manager_id", "is_hr_admin"],
  statutory: ["pan", "aadhaar", "uan", "account_number", "ifsc", "bank_name"],
  emergency: ["emergency_name", "emergency_relation", "emergency_mobile"],
};

export type FieldErrors = Partial<Record<keyof EmployeeInput, string>>;

export function validatePan(v: string) { return PAN_RE.test(v) ? null : MESSAGES.pan; }
export function validateAadhaar(v: string) { return AADHAAR_RE.test(v) ? null : MESSAGES.aadhaar; }
export function validateUan(v: string) { return !v || UAN_RE.test(v) ? null : MESSAGES.uan; }
export function validateIfsc(v: string) { return IFSC_RE.test(v) ? null : MESSAGES.ifsc; }
export function validateMobile(v: string) { return MOBILE_RE.test(v) ? null : MESSAGES.mobile; }
export function validatePin(v: string) { return PIN_RE.test(v) ? null : MESSAGES.pin; }
export function validateState(v: string) { return (INDIAN_STATES as readonly string[]).includes(v) ? null : MESSAGES.state; }

/**
 * Validate a full employee form. In edit mode statutory/bank fields may be blank
 * (meaning "keep the stored value"), because stored values are never sent to the browser.
 */
export function validateEmployee(raw: EmployeeInput, mode: "create" | "edit" = "create"): FieldErrors {
  const v = normaliseIds(raw);
  const e: FieldErrors = {};
  const required = (k: keyof EmployeeInput, label: string) => {
    if (!v[k] || (typeof v[k] === "string" && !(v[k] as string).trim())) e[k] = `${label} is required`;
  };

  required("full_name", "Full name");
  if (!e.full_name && v.full_name.length < 2) e.full_name = "Enter the full name";
  required("email", "Email");
  if (!e.email && !EMAIL_RE.test(v.email)) e.email = MESSAGES.email;
  e.mobile = validateMobile(v.mobile) ?? undefined;
  required("dob", "Date of birth");
  if (!["Female", "Male", "Other"].includes(v.gender)) e.gender = "Pick a gender";
  required("address_line", "Address");
  required("city", "City");
  e.state = validateState(v.state) ?? undefined;
  e.pin_code = validatePin(v.pin_code) ?? undefined;

  required("date_of_joining", "Date of joining");
  if (v.dob && v.date_of_joining && !isAtLeast18On(v.dob, v.date_of_joining)) e.dob = MESSAGES.age;
  required("designation", "Designation");
  required("department_id", "Department");
  required("location_id", "Location");

  const statutoryGiven = mode === "create" || !!(v.pan || v.aadhaar || v.uan);
  if (mode === "create" || v.pan) e.pan = validatePan(v.pan) ?? undefined;
  if (mode === "create" || v.aadhaar) e.aadhaar = validateAadhaar(v.aadhaar) ?? undefined;
  if (statutoryGiven) e.uan = validateUan(v.uan) ?? undefined;
  if (mode === "create" || v.account_number) {
    if (!ACCOUNT_RE.test(v.account_number)) e.account_number = MESSAGES.account;
  }
  if (mode === "create" || v.ifsc) e.ifsc = validateIfsc(v.ifsc) ?? undefined;
  if (mode === "create") required("bank_name", "Bank name");

  required("emergency_name", "Emergency contact name");
  required("emergency_relation", "Relation");
  e.emergency_mobile = validateMobile(v.emergency_mobile) ?? undefined;

  for (const k of Object.keys(e) as (keyof EmployeeInput)[]) if (!e[k]) delete e[k];
  return e;
}

export type ContactInput = Pick<EmployeeInput, "mobile" | "address_line" | "city" | "state" | "pin_code" | "emergency_name" | "emergency_relation" | "emergency_mobile">;

/** Self-service edit: only contact details and emergency contact. */
export function validateContact(raw: ContactInput): FieldErrors {
  const v = normaliseIds(raw);
  const e: FieldErrors = {};
  e.mobile = validateMobile(v.mobile) ?? undefined;
  if (!v.address_line) e.address_line = "Address is required";
  if (!v.city) e.city = "City is required";
  e.state = validateState(v.state) ?? undefined;
  e.pin_code = validatePin(v.pin_code) ?? undefined;
  if (!v.emergency_name) e.emergency_name = "Emergency contact name is required";
  if (!v.emergency_relation) e.emergency_relation = "Relation is required";
  e.emergency_mobile = validateMobile(v.emergency_mobile) ?? undefined;
  for (const k of Object.keys(e) as (keyof EmployeeInput)[]) if (!e[k]) delete e[k];
  return e;
}
