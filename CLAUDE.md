# CLAUDE.md — Lehar HRMS

## What this project is
An HRMS for **Konkan Coastal Foods** (≈180 employees), replacing the Excel sheet, the paper attendance register and WhatsApp leave approvals.
- Locations: **Panaji head office** (Mon–Fri, weekly off Sat + Sun) and **Verna plant** (Mon–Sat, weekly off Sun).
- Modules: **Employee Master**, **Attendance**, **Leave**, and an **Ask HR agent** that calls tools.
- Payroll stays with the external vendor. We only produce the month-end attendance summary (CSV).

## Stack
- Next.js (App Router, TypeScript), hosted on Vercel
- Supabase (Postgres) for data, with row-level security
- Clerk for login (the role is NOT stored in Clerk)
- Resend (free tier) for email
- Vercel AI SDK + a free model (Gemini or Groq) for the agent
- Any change to this stack goes in ARCHITECTURE.md → Decision log first.

## Folder rules
Code is organised by module:
```
app/(employees) app/(attendance) app/(leave) app/(reports) app/(agent)
lib/employees  lib/attendance  lib/leave  lib/reports  lib/agent
lib/auth       # the single server-side role helper
lib/dates      # all IST date helpers
tests/employees tests/attendance tests/leave tests/agent
```

## Non-negotiable rules
1. **All times in IST (Asia/Kolkata).** Never use the server's local time. Use the helpers in `lib/dates`.
2. **Never commit secrets.** Use `.env.local`; keep `.env.example` with blank values.
3. **Role checks happen on the server** on every page and API route, via `lib/auth`. Hiding a button is not a role check.
   - Only `is_hr_admin` is stored. **Manager is derived**: anyone who is `reporting_manager_id` for at least one active employee.
4. **Aadhaar is never shown unmasked anywhere**, including CSVs. PAN and bank numbers are masked unless HR clicks Reveal, which is logged.
   - PAN `ABCDE****F` · Aadhaar `XXXX XXXX 1234` · Bank account: last 4 digits only.
5. **"Available" leave balance is calculated, never stored**: `opening + accrued − used − pending`.
6. Business rules live in `RESEARCH.md` (leave policy) and must be followed exactly.
7. UI follows **DESIGN.md**: use the same status colours on every screen.
8. The agent never gets database credentials, never sees Aadhaar/PAN/bank, and every write it makes is a draft the user confirms.

## How we work
- Start every checkpoint in **plan mode**. Show the plan, wait for approval, then write code.
- Write tests first for business rules, then implement until they pass.
- Never run database resets or commit `.env` files without asking.
- After implementing a rule, explain in plain words how it works.
