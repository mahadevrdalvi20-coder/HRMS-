// Row shapes as they come back from Supabase.

export type Location = { id: string; name: string; city: string; state: string; weekly_off_days: number[] };
export type Department = { id: string; name: string };

export type Employee = {
  id: string;
  clerk_user_id: string | null;
  employee_code: string;
  full_name: string;
  email: string;
  mobile: string;
  dob: string;
  gender: "Female" | "Male" | "Other";
  address_line: string | null;
  city: string | null;
  state: string | null;
  pin_code: string | null;
  date_of_joining: string;
  last_working_day: string | null;
  designation: string;
  grade: string | null;
  department_id: string;
  location_id: string;
  reporting_manager_id: string | null;
  is_hr_admin: boolean;
  emergency_name: string | null;
  emergency_relation: string | null;
  emergency_mobile: string | null;
  created_at: string;
};

export type Holiday = { id: string; location_id: string; date: string; name: string; type: "National" | "State" | "Optional" };

export type AttendanceRow = {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  is_wfh: boolean;
  is_late: boolean;
  regularised: boolean;
};

export type RegularisationRequest = {
  id: string;
  employee_id: string;
  date: string;
  attendance_id: string | null;
  requested_in: string;
  requested_out: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  approver_id: string | null;
  approver_comment: string | null;
  decided_at: string | null;
  created_at: string;
};

export type AccrualMethod = "annual_prorated" | "monthly" | "on_request" | "none";

export type LeaveType = {
  id: string;
  code: string;
  name: string;
  annual_quota: number | null;
  accrual_method: AccrualMethod;
  carry_forward_max: number;
  half_day_allowed: boolean;
  requires_certificate_after_days: number | null;
  count_calendar_days: boolean;
  gender_restriction: "Female" | "Male" | null;
  is_active: boolean;
  sort_order: number;
};

export type LeaveBalanceRow = { id: string; employee_id: string; leave_type_id: string; year: number; opening: number; used: number };

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveRequest = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  is_half_day: boolean;
  days: number;
  reason: string;
  status: LeaveStatus;
  approver_id: string | null;
  approver_comment: string | null;
  attachment_url: string | null;
  decided_at: string | null;
  created_at: string;
};

export type AuditEntry = {
  id: number;
  table_name: string;
  record_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  action: string;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
};

/** Result type for server actions: never throw raw errors at the UI. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
