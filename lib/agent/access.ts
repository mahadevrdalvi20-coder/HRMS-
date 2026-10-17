/**
 * Which agent tools a user may have. Tools a role cannot use are not even given to the model.
 * Pure, tested in tests/agent/access.test.ts.
 */
export const EVERYONE_TOOLS = ["get_my_leave_balance", "get_holidays", "count_working_days", "explain_policy", "draft_leave_request"] as const;
export const MANAGER_TOOLS = ["get_team_today", "summarise_pending_approvals"] as const;
export const HR_TOOLS = ["flag_month_end_issues"] as const;

export type ToolName = (typeof EVERYONE_TOOLS)[number] | (typeof MANAGER_TOOLS)[number] | (typeof HR_TOOLS)[number];

export const MAX_TOOL_CALLS = 5;

export function allowedTools(role: { isHr: boolean; isManager: boolean }): ToolName[] {
  return [
    ...EVERYONE_TOOLS,
    ...(role.isManager || role.isHr ? MANAGER_TOOLS : []),
    ...(role.isHr ? HR_TOOLS : []),
  ];
}

/** Keys that must never reach the model, even masked. */
const FORBIDDEN_KEYS = /^(pan|aadhaar|uan|account_number|ifsc|bank_name|bank|statutory|dob|mobile|emergency_mobile|address_line|email|clerk_user_id)$/i;

/** Remove sensitive fields from anything a tool returns, recursively (defence in depth). */
export function scrub<T>(value: T): T {
  if (Array.isArray(value)) return value.map(scrub) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.test(k)) continue;
      out[k] = scrub(v);
    }
    return out as T;
  }
  if (typeof value === "string") {
    // 12-digit runs (Aadhaar/UAN shaped) and PAN-shaped tokens are blanked.
    return value.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[hidden]").replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[hidden]") as T;
  }
  return value;
}
