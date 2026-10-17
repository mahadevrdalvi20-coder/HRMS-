import "server-only";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { db, must } from "@/lib/db";
import type { Session } from "@/lib/auth";
import { isValidISODate, monthRange, monthOf, shiftMonth, yearOf } from "@/lib/dates";
import { holidaysFor, teamInScope, teamToday } from "@/lib/attendance/queries";
import { STATUS_META } from "@/lib/attendance/rules";
import { countLeaveDays } from "@/lib/leave/workingDays";
import { getBalances, leaveTypes } from "@/lib/leave/queries";
import { evaluateLeave } from "@/lib/leave/evaluate";
import { approvalDetails } from "@/lib/approvals/queries";
import { monthEndSummary } from "@/lib/reports/queries";
import { allowedTools, MAX_TOOL_CALLS, scrub, type ToolName } from "./access";

const dateStr = z.string().describe("Date as YYYY-MM-DD (IST)");

/**
 * Build the tools for one question. Each tool runs on the server as the signed-in user,
 * reuses the same functions and role checks as the screens, is limited to 5 calls per
 * question, and is logged in agent_log. Results are scrubbed of sensitive fields.
 */
export function buildTools(s: Session, opts: { onCall?: (name: ToolName, input: unknown, output: unknown) => void } = {}): ToolSet {
  let calls = 0;
  const allowed = new Set(allowedTools(s));

  const guarded = <I, O>(name: ToolName, fn: (input: I) => Promise<O>) => async (input: I) => {
    calls += 1;
    let output: unknown;
    if (calls > MAX_TOOL_CALLS) {
      output = { error: `Tool limit reached (${MAX_TOOL_CALLS} per question). Answer with what you already have.` };
    } else if (!allowed.has(name)) {
      output = { error: "Not allowed for this user." };
    } else {
      try {
        output = scrub(await fn(input));
      } catch (e) {
        output = { error: e instanceof Error ? e.message : "Tool failed" };
      }
    }
    await db().from("agent_log").insert({ employee_id: s.employeeId, tool: name, inputs: input as object, result: JSON.parse(JSON.stringify(output ?? null)) });
    opts.onCall?.(name, input, output);
    return output;
  };

  const all: Record<ToolName, ToolSet[string]> = {
    get_my_leave_balance: tool({
      description: "Get the signed-in user's own leave balance for the current leave year: for each leave type the opening, accrued, used, pending and available days. Use for any question about how many leaves/CL/SL/EL are left. Same numbers as the My leave screen.",
      inputSchema: z.object({}),
      execute: guarded("get_my_leave_balance", async () => {
        const b = await getBalances(s.employee, yearOf(s.today), s.today);
        return {
          year: yearOf(s.today),
          balances: b.filter((x) => x.eligible).map((x) => ({ code: x.type.code, name: x.type.name, opening: x.opening, accrued: x.accrued, used: x.used, pending: x.pending, available: x.available === null ? "unlimited" : x.available })),
        };
      }),
    }),

    get_holidays: tool({
      description: "List holidays for the user's own work location. Give a year and optionally a month (1-12). National and State holidays are days off; Optional holidays are working days.",
      inputSchema: z.object({ year: z.number().int().min(2000).max(2100).optional(), month: z.number().int().min(1).max(12).optional() }),
      execute: guarded("get_holidays", async ({ year, month }: { year?: number; month?: number }) => {
        const y = year ?? yearOf(s.today);
        const range = month ? monthRange(y, month) : { from: `${y}-01-01`, to: `${y}-12-31` };
        const h = await holidaysFor(s.employee.location_id, range.from, range.to);
        return { location: s.location.name, holidays: h.map((x) => ({ date: x.date, name: x.name, type: x.type })) };
      }),
    }),

    count_working_days: tool({
      description: "Count how many leave days a date range costs for the user: only working days at the user's location count; weekly offs and National/State holidays inside the range are skipped (no sandwich rule). Use for any 'how many days' question about dates.",
      inputSchema: z.object({ from: dateStr, to: dateStr, half_day: z.boolean().optional().describe("true for a single half day") }),
      execute: guarded("count_working_days", async ({ from, to, half_day }: { from: string; to: string; half_day?: boolean }) => {
        if (!isValidISODate(from) || !isValidISODate(to) || to < from) return { error: "Give valid dates with from <= to" };
        const holidays = await holidaysFor(s.employee.location_id, from, to);
        const r = countLeaveDays({ from, to, weeklyOffDays: s.location.weekly_off_days, holidays, isHalfDay: !!half_day && from === to });
        return { location: s.location.name, from, to, days: r.days, counted_dates: r.countedDates, skipped: r.skipped };
      }),
    }),

    explain_policy: tool({
      description: "Get the company's stored leave and attendance policy text. Answer policy questions ONLY from this text; if it is not covered, say you don't know.",
      inputSchema: z.object({ topic: z.string().describe("What the user asked about") }),
      execute: guarded("explain_policy", async () => {
        const docs = must(await db().from("policy_documents").select("key, title, body"), "policy") as { key: string; title: string; body: string }[];
        return { policy: docs.map((d) => ({ title: d.title, text: d.body })) };
      }),
    }),

    draft_leave_request: tool({
      description: "Prepare a DRAFT leave request for the user to review. Nothing is submitted: the user must click Confirm in the app. Returns the working days, balance before/after and any problems (e.g. not enough balance → LOP offer, certificate needed). Leave codes: CL, SL, EL, MAT, PAT, LOP.",
      inputSchema: z.object({
        leave_code: z.string().describe("CL, SL, EL, MAT, PAT or LOP"),
        from: dateStr,
        to: dateStr,
        half_day: z.boolean().optional(),
        reason: z.string().describe("Short reason in the user's words"),
      }),
      execute: guarded("draft_leave_request", async ({ leave_code, from, to, half_day, reason }: { leave_code: string; from: string; to: string; half_day?: boolean; reason: string }) => {
        const type = (await leaveTypes()).find((t) => t.code === leave_code.toUpperCase());
        if (!type) return { error: `Unknown leave code ${leave_code}` };
        const ev = await evaluateLeave(s, { leaveTypeId: type.id, from, to: half_day ? from : to, isHalfDay: !!half_day, reason: reason || "Leave" }, false);
        return {
          draft: true,
          status: "Draft · not submitted — the user must click Confirm",
          leave_code: type.code,
          from,
          to: half_day ? from : to,
          half_day: !!half_day,
          reason: reason || "Leave",
          days: ev.count.days,
          skipped: ev.count.skipped,
          balance_before: ev.balanceBefore,
          balance_after: ev.balanceAfter,
          problems: ev.check.errors,
          needs_certificate: ev.check.needsCertificate,
          lop_offer: ev.check.lopOffer,
          team_clashes: ev.clashes,
        };
      }),
    }),

    get_team_today: tool({
      description: "Managers/HR only: who in the user's team (direct reports; HR: everyone) is present, on leave, absent or off today.",
      inputSchema: z.object({}),
      execute: guarded("get_team_today", async () => {
        const team = await teamToday(await teamInScope(s), s.today);
        const label = (t: (typeof team)[number]) => (t.day.inProgress ? "Checked in" : t.day.status === "NONE" ? "Not checked in yet" : STATUS_META[t.day.status].label);
        const rows = team.map((t) => ({ name: t.employee.full_name, code: t.employee.employee_code, status: label(t), late: t.day.late }));
        const count = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
        return {
          date: s.today,
          scope: s.isHr ? "all employees" : "direct reports",
          counts: {
            present: count((r) => ["Present", "Work from home", "Half Day", "Checked in"].includes(r.status)),
            on_leave: count((r) => r.status === "On Leave"),
            absent_or_not_in: count((r) => ["Absent", "Not checked in yet"].includes(r.status)),
            off: count((r) => ["Holiday", "Weekly Off"].includes(r.status)),
          },
          team: rows,
        };
      }),
    }),

    summarise_pending_approvals: tool({
      description: "Managers/HR only: list leave and attendance-correction requests waiting for the user's decision, with the balance before/after and team clash warnings. Read only — the agent cannot approve or reject.",
      inputSchema: z.object({}),
      execute: guarded("summarise_pending_approvals", async () => {
        const d = await approvalDetails(s);
        return {
          leave: d.leave.map((x) => ({
            employee: x.employee.full_name, code: x.employee.employee_code, type: x.type?.code, from: x.request.from_date, to: x.request.to_date,
            days: Number(x.request.days), balance_now: x.availableNow, balance_after: x.availableAfter,
            warning: x.availableAfter !== null && x.availableAfter < 0 ? "not enough balance" : null,
            clashes: x.clashes.map((c) => `${c.name} ${c.from}–${c.to} (${c.status})`),
          })),
          corrections: d.regularisation.map((x) => ({ employee: x.employee.full_name, date: x.request.date, reason: x.request.reason })),
          note: "Approve or reject in the Approvals screen.",
        };
      }),
    }),

    flag_month_end_issues: tool({
      description: "HR only: month-end check. Flags employees with 3 or more Late marks or missed punches / pending corrections in a month, and drafts a reminder email for HR to approve (nothing is sent). Defaults to last month.",
      inputSchema: z.object({ year: z.number().int().optional(), month: z.number().int().min(1).max(12).optional() }),
      execute: guarded("flag_month_end_issues", async ({ year, month }: { year?: number; month?: number }) => {
        const def = shiftMonth(yearOf(s.today), monthOf(s.today), -1);
        const y = year ?? def.year;
        const m = month ?? def.month;
        const { rows } = await monthEndSummary(s, y, m);
        const flagged = rows
          .filter((r) => r.late_marks >= 3 || r.unresolved > 0)
          .map((r) => ({ code: r.employee_code, name: r.name, late_marks: r.late_marks, late_lop_days: r.late_lop_days, unresolved_days: r.unresolved }));
        return {
          year: y,
          month: m,
          flagged,
          draft_email: flagged.length
            ? {
                draft: true,
                status: "Draft · not sent — HR must click Confirm",
                recipients: flagged.map((f) => f.code),
                subject: `Attendance reminder for ${y}-${String(m).padStart(2, "0")}`,
                body: "Hi,\n\nOur records show Late marks or missed punches for you this month. Please check My attendance in Lehar and raise a correction for any missed punch before payroll closes.\n\nThanks,\nHR, Konkan Coastal Foods",
              }
            : null,
        };
      }),
    }),
  };

  return Object.fromEntries(Object.entries(all).filter(([name]) => allowed.has(name as ToolName)));
}
