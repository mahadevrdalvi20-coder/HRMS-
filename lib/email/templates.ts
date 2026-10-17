/** Email content for leave notifications (pure, tested in tests/leave/emails.test.ts). */
import { formatDate } from "@/lib/dates";

type Line = { code: string; from: string; to: string; days: number };

export function leaveRequestedEmail(manager: { email: string; full_name: string }, employee: { full_name: string; employee_code: string }, lines: Line[], reason: string, link: string) {
  const body = lines.map((r) => `${r.code}: ${formatDate(r.from)} to ${formatDate(r.to)} (${r.days} day${r.days === 1 ? "" : "s"})`).join("\n");
  return {
    to: manager.email,
    subject: `Leave request from ${employee.full_name}`,
    text: `Hi ${manager.full_name.split(" ")[0]},\n\n${employee.full_name} (${employee.employee_code}) applied for leave:\n${body}\nReason: ${reason}\n\nApprove or reject: ${link}`,
  };
}

export function leaveDecidedEmail(employee: { email: string; full_name: string }, approver: string, req: { code: string; from: string; to: string; days: number }, approved: boolean, comment: string | null, link: string) {
  return {
    to: employee.email,
    subject: `Your ${req.code} request was ${approved ? "approved" : "rejected"}`,
    text: `Hi ${employee.full_name.split(" ")[0]},\n\nYour ${req.code} for ${formatDate(req.from)} to ${formatDate(req.to)} (${req.days} day${req.days === 1 ? "" : "s"}) was ${approved ? "approved" : "rejected"} by ${approver}.${comment ? `\nComment: ${comment}` : ""}\n\n${link}`,
  };
}
