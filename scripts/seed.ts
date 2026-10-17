/**
 * Seed data for Lehar HRMS.
 *   npm run seed
 * Creates: 2 locations, 4 departments, 6 leave types, 20 employees (1 HR Admin, 3 managers),
 * holidays for the current year per location, leave balances, policy text,
 * attendance for last month + this month up to yesterday, and sample leave requests.
 *
 * Safe by design: it refuses to run if employees already exist (it never deletes data).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  addDays, dayOfWeek, eachDate, istDateTimeToUtc, monthRange, shiftMonth, todayIST, yearOf, monthOf,
} from "../lib/dates/ist";

config({ path: ".env.local" });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

// Deterministic pseudo-random numbers so every seed looks the same.
let state = 42;
function rand() {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
}

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data as T;
}

const TODAY = todayIST();
const YEAR = yearOf(TODAY);

// Clerk development instances accept any "+clerk_test" email with the code 424242.
const mail = (first: string, last: string) => `${first}.${last}+clerk_test@example.com`.toLowerCase();

type Seed = {
  key: string; first: string; last: string; gender: "Female" | "Male"; dob: string; doj: string;
  designation: string; grade: string; dept: string; loc: "HO" | "PLANT"; manager?: string; hr?: boolean; lwd?: string;
};

const PEOPLE: Seed[] = [
  { key: "asha", first: "Asha", last: "Naik", gender: "Female", dob: "1986-04-12", doj: "2015-06-01", designation: "HR Manager", grade: "M2", dept: "Human Resources", loc: "HO", hr: true },
  { key: "rohan", first: "Rohan", last: "Kamat", gender: "Male", dob: "1982-09-03", doj: "2012-02-15", designation: "Finance & Admin Manager", grade: "M2", dept: "Finance & Accounts", loc: "HO" },
  { key: "sunil", first: "Sunil", last: "Gaonkar", gender: "Male", dob: "1980-11-21", doj: "2010-08-01", designation: "Plant Manager", grade: "M3", dept: "Production", loc: "PLANT" },
  { key: "priya", first: "Priya", last: "Dessai", gender: "Female", dob: "1988-01-30", doj: "2017-03-20", designation: "Sales Manager", grade: "M2", dept: "Sales & Marketing", loc: "HO" },
  // Rohan's team (head office)
  { key: "neha", first: "Neha", last: "Shirodkar", gender: "Female", dob: "1996-07-08", doj: "2021-07-05", designation: "HR Executive", grade: "E2", dept: "Human Resources", loc: "HO", manager: "rohan" },
  { key: "amit", first: "Amit", last: "Prabhu", gender: "Male", dob: "1993-05-17", doj: "2019-11-11", designation: "Accountant", grade: "E3", dept: "Finance & Accounts", loc: "HO", manager: "rohan" },
  { key: "kavya", first: "Kavya", last: "Kerkar", gender: "Female", dob: "1998-12-02", doj: "2023-01-09", designation: "Accounts Assistant", grade: "E1", dept: "Finance & Accounts", loc: "HO", manager: "rohan" },
  { key: "joel", first: "Joel", last: "Fernandes", gender: "Male", dob: "1991-03-25", doj: "2018-04-02", designation: "Admin Officer", grade: "E2", dept: "Finance & Accounts", loc: "HO", manager: "rohan" },
  { key: "sneha", first: "Sneha", last: "Volvoikar", gender: "Female", dob: "1997-08-14", doj: "2022-10-03", designation: "Payroll Coordinator", grade: "E1", dept: "Human Resources", loc: "HO", manager: "rohan" },
  // Sunil's team (plant)
  { key: "ravi", first: "Ravi", last: "Shetty", gender: "Male", dob: "1990-10-10", doj: "2016-05-16", designation: "Production Supervisor", grade: "S2", dept: "Production", loc: "PLANT", manager: "sunil" },
  { key: "ganesh", first: "Ganesh", last: "Morajkar", gender: "Male", dob: "1994-02-19", doj: "2020-01-06", designation: "Machine Operator", grade: "W2", dept: "Production", loc: "PLANT", manager: "sunil" },
  { key: "maria", first: "Maria", last: "Dsouza", gender: "Female", dob: "1995-06-23", doj: "2019-06-10", designation: "Quality Analyst", grade: "S1", dept: "Production", loc: "PLANT", manager: "sunil" },
  { key: "santosh", first: "Santosh", last: "Naik", gender: "Male", dob: "1989-09-01", doj: "2014-09-15", designation: "Maintenance Technician", grade: "W3", dept: "Production", loc: "PLANT", manager: "sunil" },
  { key: "pooja", first: "Pooja", last: "Gawas", gender: "Female", dob: "1999-04-04", doj: "2024-02-12", designation: "Packing Supervisor", grade: "S1", dept: "Production", loc: "PLANT", manager: "sunil" },
  { key: "anil", first: "Anil", last: "Velip", gender: "Male", dob: "1992-12-12", doj: "2021-03-01", designation: "Stores Assistant", grade: "W1", dept: "Production", loc: "PLANT", manager: "sunil" },
  { key: "vikas", first: "Vikas", last: "Parab", gender: "Male", dob: "1987-07-07", doj: "2013-01-07", designation: "Boiler Operator", grade: "W2", dept: "Production", loc: "PLANT", manager: "sunil", lwd: `${YEAR}-09-30` },
  // Priya's team (head office)
  { key: "rahul", first: "Rahul", last: "Pai", gender: "Male", dob: "1993-01-11", doj: "2020-08-17", designation: "Area Sales Executive", grade: "E2", dept: "Sales & Marketing", loc: "HO", manager: "priya" },
  { key: "fatima", first: "Fatima", last: "Khan", gender: "Female", dob: "1996-10-28", doj: "2022-05-02", designation: "Marketing Executive", grade: "E1", dept: "Sales & Marketing", loc: "HO", manager: "priya" },
  { key: "meera", first: "Meera", last: "Sawant", gender: "Female", dob: "2000-03-15", doj: `${YEAR}-07-01`, designation: "Sales Trainee", grade: "T1", dept: "Sales & Marketing", loc: "HO", manager: "priya" },
  { key: "nikhil", first: "Nikhil", last: "Borkar", gender: "Male", dob: "1997-11-05", doj: "2023-09-04", designation: "Key Account Executive", grade: "E1", dept: "Sales & Marketing", loc: "HO", manager: "priya" },
];

const HOLIDAYS_2026: { date: string; name: string; type: "National" | "State" | "Optional"; only?: "HO" | "PLANT" }[] = [
  { date: "2026-01-26", name: "Republic Day", type: "National" },
  { date: "2026-03-04", name: "Holi", type: "State" },
  { date: "2026-04-03", name: "Good Friday", type: "State" },
  { date: "2026-05-30", name: "Goa Statehood Day", type: "State" },
  { date: "2026-06-24", name: "Sao Joao (Verna feast)", type: "State", only: "PLANT" },
  { date: "2026-08-15", name: "Independence Day", type: "National" },
  { date: "2026-09-14", name: "Ganesh Chaturthi", type: "State" },
  { date: "2026-10-02", name: "Gandhi Jayanti", type: "National" },
  { date: "2026-10-20", name: "Dussehra", type: "State" },
  { date: "2026-11-09", name: "Diwali", type: "Optional" },
  { date: "2026-12-03", name: "Feast of St Francis Xavier", type: "State", only: "HO" },
  { date: "2026-12-19", name: "Goa Liberation Day", type: "State" },
  { date: "2026-12-25", name: "Christmas", type: "National" },
];

const POLICY = [
  {
    key: "leave",
    title: "Leave policy",
    body: `Leave year: 1 January to 31 December.
Casual Leave (CL): 8 days a year, credited on 1 January. Employees who join during the year get a pro-rated credit (months from joining month to December, joining month counted if joined on or before the 15th). Half day allowed. Unused CL lapses on 31 December.
Sick Leave (SL): 7 days a year, credited on 1 January, pro-rated for joiners the same way. Half day allowed. Lapses on 31 December. Sick leave of more than 2 consecutive days needs a medical certificate upload.
Earned Leave (EL): 15 days a year, earned at 1.25 days per completed month of service. Up to 30 days carry forward to the next year. No half day.
Maternity Leave: 26 weeks (182 calendar days) as per the Maternity Benefit (Amendment) Act 2017, granted on request to female employees.
Paternity Leave: 5 working days, company policy, granted on request to male employees.
Loss of Pay (LOP): unlimited, half day allowed, unpaid.
Leave days are working days only. Weekly offs and holidays inside a leave period are not counted (Konkan has no sandwich rule). Saturday is a working day at the Verna plant but a weekly off at the Panaji head office.
You cannot apply for leave with insufficient balance; the app offers to convert the extra days to LOP.
Leave cannot be applied more than 30 days in the past.
Your reporting manager approves or rejects leave. Nobody can approve their own leave. The balance changes only when leave is approved. You can cancel pending leave, or approved leave that has not started, and the days return to your balance.`,
  },
  {
    key: "attendance",
    title: "Attendance policy",
    body: `All times are in IST.
Panaji head office works Monday to Friday; Saturday and Sunday are weekly offs. Verna plant works Monday to Saturday; Sunday is the weekly off.
Check in and check out once a day in Lehar. Hours worked of 8 or more is Present, 4 to under 8 hours is Half Day, under 4 hours or no punch is Absent.
Check-in after 10:15 AM is Late. Every 3 Late marks in a calendar month add half a day of loss of pay.
Work from home days are marked WFH and count as Present.
A day with approved leave is On Leave even if you punched in.
If you missed a punch, raise a regularisation request with the correct times and a reason. Your attendance changes only after your manager approves it. HR can correct attendance directly with a recorded reason.
Holidays are per location and are National, State or Optional.`,
  },
];

async function main() {
  const existing = await must(sb.from("employees").select("id", { count: "exact", head: false }).limit(1), "check employees");
  if (existing && existing.length > 0) {
    console.error("Employees already exist. The seed script never deletes data; run it on an empty database.");
    process.exit(1);
  }

  console.log("Locations, departments, leave types…");
  const locs = await must(
    sb.from("locations").insert([
      { name: "Panaji Head Office", city: "Panaji", state: "Goa", weekly_off_days: [0, 6] },
      { name: "Verna Plant", city: "Verna", state: "Goa", weekly_off_days: [0] },
    ]).select(),
    "locations",
  );
  const locId = { HO: locs.find((l: { name: string }) => l.name.startsWith("Panaji"))!.id, PLANT: locs.find((l: { name: string }) => l.name.startsWith("Verna"))!.id };
  const weeklyOff = { HO: [0, 6], PLANT: [0] };

  const depts = await must(
    sb.from("departments").insert(["Human Resources", "Finance & Accounts", "Production", "Sales & Marketing"].map((name) => ({ name }))).select(),
    "departments",
  );
  const deptId = Object.fromEntries(depts.map((d: { name: string; id: string }) => [d.name, d.id]));

  const types = await must(
    sb.from("leave_types").insert([
      { code: "CL", name: "Casual Leave", annual_quota: 8, accrual_method: "annual_prorated", carry_forward_max: 0, half_day_allowed: true, sort_order: 1 },
      { code: "SL", name: "Sick Leave", annual_quota: 7, accrual_method: "annual_prorated", carry_forward_max: 0, half_day_allowed: true, requires_certificate_after_days: 2, sort_order: 2 },
      { code: "EL", name: "Earned Leave", annual_quota: 15, accrual_method: "monthly", carry_forward_max: 30, half_day_allowed: false, sort_order: 3 },
      { code: "MAT", name: "Maternity Leave", annual_quota: 182, accrual_method: "on_request", carry_forward_max: 0, half_day_allowed: false, count_calendar_days: true, gender_restriction: "Female", sort_order: 4 },
      { code: "PAT", name: "Paternity Leave", annual_quota: 5, accrual_method: "on_request", carry_forward_max: 0, half_day_allowed: false, gender_restriction: "Male", sort_order: 5 },
      { code: "LOP", name: "Loss of Pay", annual_quota: null, accrual_method: "none", carry_forward_max: 0, half_day_allowed: true, sort_order: 6 },
    ]).select(),
    "leave types",
  );
  const typeId = Object.fromEntries(types.map((t: { code: string; id: string }) => [t.code, t.id]));

  console.log("Holidays…");
  const holidayRows = HOLIDAYS_2026.flatMap((h) => {
    const date = `${YEAR}${h.date.slice(4)}`;
    const locsFor: ("HO" | "PLANT")[] = h.only ? [h.only] : ["HO", "PLANT"];
    return locsFor.map((l) => ({ location_id: locId[l], date, name: h.name, type: h.type }));
  });
  await must(sb.from("holidays").insert(holidayRows).select("id"), "holidays");
  const holidaySet = { HO: new Set(holidayRows.filter((h) => h.location_id === locId.HO).map((h) => h.date)), PLANT: new Set(holidayRows.filter((h) => h.location_id === locId.PLANT).map((h) => h.date)) };

  await must(sb.from("policy_documents").insert(POLICY).select("id"), "policy");

  console.log("Employees…");
  const idByKey: Record<string, string> = {};
  // Insert managers first so reports can point at them.
  const ordered = [...PEOPLE.filter((p) => !p.manager), ...PEOPLE.filter((p) => p.manager)];
  for (const [i, p] of ordered.entries()) {
    const row = await must(
      sb.from("employees").insert({
        full_name: `${p.first} ${p.last}`,
        email: mail(p.first, p.last),
        mobile: `98${String(22000000 + i * 7919).padStart(8, "0")}`,
        dob: p.dob,
        gender: p.gender,
        address_line: `${10 + i}, ${p.loc === "HO" ? "Altinho" : "Verna Industrial Estate"}`,
        city: p.loc === "HO" ? "Panaji" : "Verna",
        state: "Goa",
        pin_code: p.loc === "HO" ? "403001" : "403722",
        date_of_joining: p.doj,
        last_working_day: p.lwd ?? null,
        designation: p.designation,
        grade: p.grade,
        department_id: deptId[p.dept],
        location_id: locId[p.loc],
        reporting_manager_id: p.manager ? idByKey[p.manager] : null,
        is_hr_admin: !!p.hr,
        emergency_name: `${p.gender === "Female" ? "Suresh" : "Anita"} ${p.last}`,
        emergency_relation: p.gender === "Female" ? "Father" : "Mother",
        emergency_mobile: `97${String(33000000 + i * 4243).padStart(8, "0")}`,
      }).select("id").single(),
      `employee ${p.first}`,
    );
    idByKey[p.key] = (row as { id: string }).id;
    const letters = (p.last + "XXXXX").toUpperCase().replace(/[^A-Z]/g, "");
    await must(
      sb.from("employee_statutory").insert({
        employee_id: idByKey[p.key],
        pan: `ABC${letters[0]}${letters[1]}${String(1000 + i * 37).slice(0, 4)}${letters[2]}`,
        aadhaar: String(234500000000 + i * 1234567),
        uan: p.doj.startsWith(String(YEAR)) ? null : String(100900000000 + i * 98765),
      }).select("employee_id"),
      `statutory ${p.first}`,
    );
    await must(
      sb.from("employee_bank").insert({
        employee_id: idByKey[p.key],
        account_number: String(50100000000000 + i * 1234577),
        ifsc: i % 2 ? "HDFC0001234" : "SBIN0004321",
        bank_name: i % 2 ? "HDFC Bank" : "State Bank of India",
      }).select("employee_id"),
      `bank ${p.first}`,
    );
  }

  console.log("Leave requests…");
  type Req = { who: string; code: string; from: string; to: string; days: number; status: "approved" | "pending" | "rejected"; reason: string; half?: boolean };
  const lastMonth = shiftMonth(yearOf(TODAY), monthOf(TODAY), -1);
  const lm = monthRange(lastMonth.year, lastMonth.month);
  const nextWorking = (from: string, loc: "HO" | "PLANT", n: number) => {
    const out: string[] = [];
    for (let d = from; out.length < n; d = addDays(d, 1)) {
      if (!weeklyOff[loc].includes(dayOfWeek(d)) && !holidaySet[loc].has(d)) out.push(d);
    }
    return out;
  };
  const future1 = nextWorking(addDays(TODAY, 7), "PLANT", 2);
  const future2 = nextWorking(addDays(TODAY, 10), "HO", 1);
  const past1 = nextWorking(addDays(lm.from, 9), "HO", 2);
  const past2 = nextWorking(addDays(lm.from, 14), "PLANT", 1);
  const recent = nextWorking(addDays(TODAY, -6), "PLANT", 1);
  const reqs: Req[] = [
    { who: "amit", code: "CL", from: past1[0], to: past1[1], days: 2, status: "approved", reason: "Family function in Margao" },
    { who: "ganesh", code: "SL", from: past2[0], to: past2[0], days: 1, status: "approved", reason: "Fever" },
    { who: "maria", code: "EL", from: recent[0], to: recent[0], days: 1, status: "approved", reason: "Personal work" },
    { who: "ravi", code: "CL", from: future1[0], to: future1[1], days: 2, status: "pending", reason: "Village feast" },
    { who: "santosh", code: "CL", from: future1[0], to: future1[0], days: 1, status: "pending", reason: "Bank work" },
    { who: "rahul", code: "EL", from: future2[0], to: future2[0], days: 1, status: "pending", reason: "Sister's engagement" },
    { who: "fatima", code: "CL", from: past1[0], to: past1[0], days: 0.5, half: true, status: "rejected", reason: "Personal" },
  ];
  const usedBy: Record<string, number> = {};
  for (const r of reqs) {
    const p = PEOPLE.find((x) => x.key === r.who)!;
    await must(
      sb.from("leave_requests").insert({
        employee_id: idByKey[r.who], leave_type_id: typeId[r.code], from_date: r.from, to_date: r.to,
        is_half_day: !!r.half, days: r.days, reason: r.reason, status: r.status,
        approver_id: r.status === "pending" ? null : idByKey[p.manager!],
        approver_comment: r.status === "rejected" ? "Quarter-end closing that day" : r.status === "approved" ? "Approved" : null,
        decided_at: r.status === "pending" ? null : new Date().toISOString(),
      }).select("id"),
      `leave ${r.who}`,
    );
    if (r.status === "approved" && yearOf(r.from) === YEAR) usedBy[`${r.who}:${r.code}`] = (usedBy[`${r.who}:${r.code}`] ?? 0) + r.days;
  }

  console.log("Leave balances…");
  const balanceRows = PEOPLE.flatMap((p) =>
    types.map((t: { id: string; code: string }) => ({
      employee_id: idByKey[p.key],
      leave_type_id: t.id,
      year: YEAR,
      // EL carried forward from last year for people who joined before this year.
      opening: t.code === "EL" && yearOf(p.doj) < YEAR ? Math.min(30, 4 + (p.key.length * 3) % 12) : 0,
      used: usedBy[`${p.key}:${t.code}`] ?? 0,
    })),
  );
  await must(sb.from("leave_balances").insert(balanceRows).select("id"), "balances");

  console.log("Attendance…");
  const leaveDays = new Set(reqs.filter((r) => r.status === "approved").flatMap((r) => eachDate(r.from, r.to).map((d) => `${r.who}:${d}`)));
  const rows: Record<string, unknown>[] = [];
  const yesterday = addDays(TODAY, -1);
  for (const p of PEOPLE) {
    for (const date of eachDate(lm.from, yesterday)) {
      if (date < p.doj) continue;
      if (p.lwd && date > p.lwd) continue;
      if (weeklyOff[p.loc].includes(dayOfWeek(date)) || holidaySet[p.loc].has(date)) continue;
      if (leaveDays.has(`${p.key}:${date}`)) continue;
      const r = rand();
      if (r < 0.03) continue; // absent, no punch
      // Ravi gets 3 lates in the current month to demonstrate late LOP.
      const forcedLate = p.key === "ravi" && date >= monthRange(yearOf(TODAY), monthOf(TODAY)).from && rows.filter((x) => x.employee_id === idByKey.ravi && x.is_late && (x.date as string) >= monthRange(yearOf(TODAY), monthOf(TODAY)).from).length < 3 && rand() < 0.6;
      const late = forcedLate || r > 0.94;
      const inTime = late ? `10:${String(16 + Math.floor(rand() * 30)).padStart(2, "0")}` : `09:${String(Math.floor(rand() * 45)).padStart(2, "0")}`;
      const missedOut = r > 0.03 && r < 0.05; // missed check-out
      const half = r >= 0.05 && r < 0.08;
      const outHour = half ? 14 : 18 + (late ? 1 : 0);
      const outTime = `${outHour}:${String(15 + Math.floor(rand() * 40)).padStart(2, "0")}`;
      rows.push({
        employee_id: idByKey[p.key],
        date,
        check_in: istDateTimeToUtc(date, inTime).toISOString(),
        check_out: missedOut ? null : istDateTimeToUtc(date, outTime).toISOString(),
        is_wfh: p.loc === "HO" && rand() < 0.08,
        is_late: late,
      });
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await must(sb.from("attendance").insert(rows.slice(i, i + 500)).select("id"), "attendance");
  }

  console.log(`\nDone. ${PEOPLE.length} employees, ${rows.length} attendance rows.\nTest logins (verification code 424242 on a Clerk development instance):`);
  for (const p of PEOPLE.filter((x) => x.hr || !x.manager || ["ravi", "meera", "vikas"].includes(x.key))) {
    const role = p.hr ? "HR Admin" : !p.manager ? "Manager" : p.lwd ? "Deactivated" : "Employee";
    console.log(`  ${role.padEnd(12)} ${mail(p.first, p.last)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
