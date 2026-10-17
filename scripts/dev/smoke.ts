/**
 * Integration smoke test against a seeded database (local or Supabase). Read-mostly;
 * it approves and then cancels one seeded pending request.
 *   npx tsx --conditions=react-server scripts/dev/smoke.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { sessionForEmail } from "@/lib/agent/testSession";
import { getBalances } from "@/lib/leave/queries";
import { evaluateLeave } from "@/lib/leave/evaluate";
import { teamInScope, teamToday, myMonth } from "@/lib/attendance/queries";
import { approvalDetails } from "@/lib/approvals/queries";
import { monthEndSummary } from "@/lib/reports/queries";
import { toCsv } from "@/lib/reports/summary";
import { buildTools } from "@/lib/agent/tools";
import { getProfile, listDirectory } from "@/lib/employees/queries";
import { db } from "@/lib/db";
import { addDays, dayOfWeek, monthOf, shiftMonth, yearOf } from "@/lib/dates";

let fails = 0;
const ok = (cond: boolean, msg: string, extra?: unknown) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${msg}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ""}`);
  if (!cond) fails++;
};

async function main() {
  const amit = await sessionForEmail("amit.prabhu+clerk_test@example.com");
  const meera = await sessionForEmail("meera.sawant+clerk_test@example.com");
  const rohan = await sessionForEmail("rohan.kamat+clerk_test@example.com");
  const sunil = await sessionForEmail("sunil.gaonkar+clerk_test@example.com");
  const asha = await sessionForEmail("asha.naik+clerk_test@example.com");
  const y = yearOf(amit.today);

  ok(asha.isHr && !asha.isManager, "Asha is HR Admin (not a manager)");
  ok(rohan.isManager && !rohan.isHr && rohan.directReportIds.length === 6, "Rohan is a derived manager with 6 reports", rohan.directReportIds.length);
  ok(!amit.isManager && !amit.isHr, "Amit is an employee");
  ok(sunil.directReportIds.length === 6, "Sunil: 6 active reports (Vikas exited is excluded)", sunil.directReportIds.length);

  const mb = await getBalances(meera.employee, y, meera.today);
  ok(mb.find((b) => b.type.code === "CL")?.accrued === 4 && mb.find((b) => b.type.code === "SL")?.accrued === 3.5, "1 July joiner: CL 4, SL 3.5", mb.map((b) => [b.type.code, b.accrued]));
  ok(!mb.find((b) => b.type.code === "PAT")?.eligible, "Paternity not shown to a female employee");
  const ab = await getBalances(amit.employee, y, amit.today);
  console.log("     amit balances", ab.map((b) => `${b.type.code}:${b.available}`).join(" "));

  // Friday → Monday at head office
  let fri = addDays(amit.today, 1);
  while (dayOfWeek(fri) !== 5) fri = addDays(fri, 1);
  const types = (await db().from("leave_types").select("id, code")).data!;
  const CL = types.find((t) => t.code === "CL")!.id;
  const ev = await evaluateLeave(amit, { leaveTypeId: CL, from: fri, to: addDays(fri, 3), isHalfDay: false, reason: "trip" }, false);
  ok(ev.count.days === 2, "Fri–Mon at Panaji = 2 days", ev.count);
  const evBig = await evaluateLeave(amit, { leaveTypeId: CL, from: fri, to: addDays(fri, 24), isHalfDay: false, reason: "long trip" }, false);
  ok(!!evBig.check.lopOffer, "More CL than available → LOP offer", evBig.check.lopOffer);

  const team = await teamToday(await teamInScope(rohan), rohan.today);
  ok(team.length === 6 && team.every((t) => t.employee.reporting_manager_id === rohan.employeeId), "Rohan's team today = direct reports only", team.length);

  const appr = await approvalDetails(sunil);
  ok(appr.leave.length === 2 && appr.leave.some((l) => l.clashes.length > 0), "Sunil has 2 pending leaves with a clash", appr.leave.map((l) => [l.employee.full_name, l.clashes.length]));
  const empAppr = await approvalDetails(amit);
  ok(empAppr.leave.length === 0, "an employee has no approvals");

  const last = shiftMonth(yearOf(asha.today), monthOf(asha.today), -1);
  const rep = await monthEndSummary(asha, last.year, last.month);
  ok(rep.rows.length >= 19 && rep.rows.every((r) => r.adds_up), "Month-end rows all add up", rep.rows.length);
  const csv = toCsv(rep.rows, rep.leaveCodes);
  ok(!/\d{12}/.test(csv) && !/pan|aadhaar|ifsc/i.test(csv.split("\n")[0]), "CSV has no 12-digit ids or sensitive columns");
  const mrep = await monthEndSummary(rohan, last.year, last.month);
  ok(mrep.rows.length === 6, "Manager's report = own team only", mrep.rows.length);

  const ravi = await sessionForEmail("ravi.shetty+clerk_test@example.com");
  const rm = await myMonth(ravi.employee, yearOf(ravi.today), monthOf(ravi.today), ravi.today);
  ok(rm.summary.late >= 3 && rm.summary.lateLopDays >= 0.5, "Ravi: 3+ lates this month → ½ day LOP", rm.summary);

  const prof = await getProfile(amit.employeeId);
  ok(/^XXXX XXXX \d{4}$/.test(prof!.statutory.aadhaar) && /^[A-Z]{5}\*{4}[A-Z]$/.test(prof!.statutory.pan) && /^XXXX\d{4}$/.test(prof!.bank.account_number), "Profile is masked on the server", prof!.statutory);
  const dir = await listDirectory({ status: "inactive" }, asha.today);
  ok(dir.rows.length === 1 && dir.rows[0].full_name === "Vikas Parab", "Directory inactive filter shows Vikas");

  // Agent tools as the employee and the manager
  const calls: string[] = [];
  const tools = buildTools(amit, { onCall: (n) => calls.push(n) });
  ok(!("get_team_today" in tools), "Employee agent has no team tool");
  const exec = async (name: string, input: unknown) => (tools[name] as unknown as { execute: (i: unknown, o: unknown) => Promise<unknown> }).execute(input, { toolCallId: "t", messages: [] });
  const bal = (await exec("get_my_leave_balance", {})) as { balances: { code: string; available: number }[] };
  ok(bal.balances.find((b) => b.code === "CL")?.available === ab.find((b) => b.type.code === "CL")?.available, "Agent CL = My leave CL");
  const cnt = (await exec("count_working_days", { from: fri, to: addDays(fri, 3) })) as { days: number };
  ok(cnt.days === 2, "Agent count_working_days Fri–Mon = 2");
  const draft = (await exec("draft_leave_request", { leave_code: "CL", from: fri, to: fri, reason: "dentist" })) as { draft: boolean; days: number };
  ok(draft.draft && draft.days === 1, "draft_leave_request returns a draft");
  const pend = (await db().from("leave_requests").select("id").eq("employee_id", amit.employeeId).eq("status", "pending")).data!;
  ok(pend.length === 0, "Draft created nothing in leave_requests");
  for (let i = 0; i < 4; i++) await exec("get_holidays", { year: y });
  const sixth = (await exec("get_holidays", { year: y })) as { error?: string };
  ok(!!sixth.error && /limit/i.test(sixth.error), "6th tool call is refused (limit 5)");
  const logged = (await db().from("agent_log").select("id").eq("employee_id", amit.employeeId)).data!;
  ok(logged.length === 8, "Every tool call is in agent_log", logged.length);
  const mtools = buildTools(rohan);
  const tt = (await (mtools.get_team_today as unknown as { execute: (i: unknown, o: unknown) => Promise<{ team: unknown[] }> }).execute({}, { toolCallId: "x", messages: [] }));
  ok(tt.team.length === 6 && !JSON.stringify(tt).match(/mobile|email|pan|aadhaar/i), "Manager team tool: 6 reports, no sensitive fields");

  // DB functions: approve then cancel
  const p = appr.leave.find((l) => l.employee.full_name === "Santosh Naik")!;
  const before = (await getBalances(p.employee, y, sunil.today)).find((b) => b.type.code === "CL")!;
  const selfTry = await db().rpc("decide_leave_request", { p_request: p.request.id, p_approver: p.employee.id, p_approve: true, p_comment: "self" });
  ok(!!selfTry.error, "DB refuses self-approval");
  const r1 = await db().rpc("decide_leave_request", { p_request: p.request.id, p_approver: sunil.employeeId, p_approve: true, p_comment: "ok" });
  ok(!r1.error, "Manager approves", r1.error?.message);
  const after = (await getBalances(p.employee, y, sunil.today)).find((b) => b.type.code === "CL")!;
  ok(after.used === before.used + 1 && after.pending === before.pending - 1 && after.available === before.available, "Approve: pending → used; available unchanged", { before, after });
  const r2 = await db().rpc("decide_leave_request", { p_request: p.request.id, p_approver: sunil.employeeId, p_approve: true, p_comment: "again" });
  ok(!!r2.error, "Double approval refused");
  const r3 = await db().rpc("cancel_leave_request", { p_request: p.request.id, p_employee: p.employee.id, p_today: sunil.today });
  ok(!r3.error, "Cancel approved future leave", r3.error?.message);
  const restored = (await getBalances(p.employee, y, sunil.today)).find((b) => b.type.code === "CL")!;
  ok(restored.used === before.used && restored.available === before.available + 1, "Cancel restores the balance", restored);

  // create_employee
  const dept = (await db().from("departments").select("id").limit(1).single()).data!;
  const loc = (await db().from("locations").select("id").limit(1).single()).data!;
  const ce = await db().rpc("create_employee", { p: { full_name: "Test Joiner", email: "TEST.joiner@example.com", mobile: "9812345678", dob: "2000-01-01", gender: "Female", date_of_joining: amit.today, designation: "Trainee", department_id: dept.id, location_id: loc.id, reporting_manager_id: rohan.employeeId, pan: "ZZZZZ9999Z", aadhaar: "999988887777", uan: "", account_number: "123456789", ifsc: "HDFC0001234", bank_name: "HDFC", emergency_name: "X", emergency_relation: "Mother", emergency_mobile: "9812345679" }, p_actor: asha.employeeId });
  ok(!ce.error && /^KCF\d{4}$/.test(ce.data?.employee_code), "create_employee generates a code", ce.data?.employee_code ?? ce.error?.message);
  const loop = await db().from("employees").update({ reporting_manager_id: ce.data?.id }).eq("id", rohan.employeeId);
  ok(!!loop.error && /loop/.test(loop.error.message), "Reporting loop blocked in DB");

  // RLS with the public anon key
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const s1 = await anon.from("employee_statutory").select("*");
  ok(!!s1.error || (s1.data ?? []).length === 0, "anon key cannot read statutory", s1.error?.message);
  const s2 = await anon.from("employees").select("*");
  ok((s2.data ?? []).length === 0, "anon key reads no employees (RLS)", s2.error?.message ?? s2.data?.length);

  console.log(fails ? `\n${fails} FAILED` : "\nALL OK");
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
