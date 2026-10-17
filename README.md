# Lehar HRMS — Konkan Coastal Foods

Employee Master, Attendance, Leave and an **Ask HR** agent for a 180-person company with a head office in Panaji (Mon–Fri) and a plant in Verna (Mon–Sat).

- **Live URL:** _add your Vercel URL here after deploying_
- Docs: [RESEARCH.md](RESEARCH.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DESIGN.md](DESIGN.md) · [CLAUDE.md](CLAUDE.md)
- Stack: Next.js 15 (App Router, TypeScript) · Supabase Postgres · Clerk · Resend · Vercel AI SDK + Gemini · Vitest

## Setup (free tiers only)

1. **Install:** `npm install` (Node 20+).
2. **Supabase:** create a project → *SQL editor* → paste and run [`supabase/migrations/0001_schema.sql`](supabase/migrations/0001_schema.sql). It creates every table, constraint, trigger, the three DB functions, RLS, and a private `certificates` storage bucket.
3. **Clerk:** create a *development* application with **Email** sign-in (email code). Do not add roles in Clerk; roles come from the database.
4. **Resend** (optional): create an API key. Without it, emails are printed in the server log.
5. **Gemini:** create a free API key at https://aistudio.google.com/apikey.
6. **Env:** `cp .env.example .env.local` and fill in:

   | Variable | Where |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project settings → API |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk → API keys |
   | `RESEND_API_KEY`, `EMAIL_FROM` | Resend (on the free plan without a domain, mail only reaches your own Resend account email) |
   | `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio |
   | `NEXT_PUBLIC_APP_URL` | Your live URL (used in email links) |

   `.env.local` is git-ignored. Never commit keys.
7. **Seed:** `npm run seed` — 2 locations, 4 departments, 6 leave types, 20 employees (1 HR Admin, 3 managers), this year's holidays per location, leave balances, policy text, last month + this month's attendance and sample leave requests. It refuses to run if employees already exist.
8. **Run:** `npm run dev` → http://localhost:3000
9. **Deploy:** import the GitHub repo in Vercel, add the same env vars, deploy, then put the URL in `NEXT_PUBLIC_APP_URL` and above.

## Test logins

Sign in with these emails on a Clerk **development** instance; any `+clerk_test` address accepts the verification code **424242**.

| Role | Email | Notes |
|---|---|---|
| HR Admin | `asha.naik+clerk_test@example.com` | Directory, settings, all approvals and reports. Reports to Rohan, so her own leave goes to him |
| Manager (head office) | `rohan.kamat+clerk_test@example.com` | 6 direct reports |
| Manager (plant) | `sunil.gaonkar+clerk_test@example.com` | 6 reports; 2 pending leave requests that clash |
| Manager (sales) | `priya.dessai+clerk_test@example.com` | 4 reports |
| Employee (head office) | `amit.prabhu+clerk_test@example.com` | Used by the agent tests |
| Employee (plant) | `ravi.shetty+clerk_test@example.com` | 3 Lates this month → ½ day LOP |
| Employee, joined 1 July | `meera.sawant+clerk_test@example.com` | Pro-rated CL 4 / SL 3.5 |
| Deactivated | `vikas.parab+clerk_test@example.com` | Last working day 30 Sep → access denied |

## Tests

| Command | What it checks |
|---|---|
| `npm test` | 73 unit tests for every business rule (validation, masking, loops, IST, day status, Late/LOP, working days, pro-rating, balances, apply/cancel/approve, emails, CSV, agent access) |
| `npm run test:tz` | The same tests under `America/New_York` and `Asia/Tokyo` — results must not change |
| `npm run smoke` | 34 integration checks against a seeded database (roles, balances, approve → cancel, self-approval blocked, RLS, agent tool limit and `agent_log`) |
| `npm run test:agent` | Runs the 18 attack prompts in `tests/agent/prompts.json` against Gemini and reports pass/fail (`npm run test:agent -- fri-mon` runs one) |
| `npm run typecheck`, `npm run build` | TypeScript and production build |

### Definition-of-done checklist → where it is tested

| Checklist item | Test |
|---|---|
| Code generated and unique | DB default + unique; `smoke` create_employee |
| Invalid PAN/IFSC/9-digit mobile rejected with a clear message | `tests/employees/validation.test.ts` |
| Aged 17 on joining rejected | same + DB check constraint |
| A→B then B→A blocked | `tests/employees` + DB trigger (`smoke`) |
| Can't open another profile by URL | `tests/auth/rules.test.ts` (`canViewEmployee`) + `/employees/[id]` returns 404 |
| Aadhaar never shown in full, incl. CSV | masking + CSV tests; `smoke` profile/CSV |
| Designation change creates audit entry | `updateEmployee` writes `audit_log` per changed field |
| Deactivated employee can't log in after LWD | `tests/auth` (`accessDecision`) |
| Check in twice → one record | `tests/attendance` (`planCheckIn`) + unique constraint |
| 10:20 is Late; 3rd Late → ½ LOP | `tests/attendance` |
| 5 h Half Day; 8 h Present | `tests/attendance` |
| Plant Saturday works; HO Saturday off | `tests/attendance` |
| Verna state holiday not at Panaji | `tests/attendance` |
| Regularisation changes attendance only after approval | `decideRegularisation` writes attendance only on approve |
| 1 July joiner pro-rated CL/SL | `tests/leave` + `smoke` |
| Fri–Mon at HO = 2 | `tests/leave` + `smoke` + agent prompt `fri-mon` |
| More CL than available → LOP offer | `tests/leave` + `smoke` |
| SL 3 days needs certificate | `tests/leave` |
| Balance unchanged while pending, changes on approval | `tests/leave` + `smoke` |
| Cancelling approved future leave restores balance | `tests/leave` + `smoke` |
| Emails on request and decision | `tests/leave/emails.test.ts` |
| Manager can't approve own leave | `tests/auth` + DB function (`smoke`) |
| CSV totals match calendar for 3 employees | `tests/reports/summary.test.ts` |
| Agent: CL = My leave; Fri–Mon via `count_working_days`; draft not submitted; Aadhaar/approve refused; team access; "I don't know"; `agent_log`; Hinglish | `tests/agent/access.test.ts`, `smoke`, `npm run test:agent` |

## Where each rule lives

| Rule | File · function |
|---|---|
| Role check (every page, action, API) | `lib/auth/session.ts` → `requireSession`, `requireHr`, `requireManagerOrHr`; rules in `lib/auth/rules.ts` |
| IST | `lib/dates/ist.ts` |
| Indian field validation | `lib/employees/validation.ts` → `validateEmployee` |
| Masking | `lib/employees/mask.ts` |
| Reporting loop | `lib/employees/reporting.ts` → `createsReportingLoop` (+ DB trigger) |
| Day status, Late, late LOP | `lib/attendance/rules.ts` → `computeDayStatus`, `isLate`, `lateLopDates` |
| Working days | `lib/leave/workingDays.ts` → `countLeaveDays` |
| Accrual, pro-rating, available | `lib/leave/balance.ts` → `accruedFor`, `proRataMonths`, `computeBalance` |
| Apply rules, LOP split, cancel | `lib/leave/rules.ts` |
| Approve / cancel (atomic) | `decide_leave_request`, `cancel_leave_request` in the migration |
| Month-end summary | `lib/reports/summary.ts` |
| Agent tools and guardrails | `lib/agent/tools.ts`, `lib/agent/access.ts`, `lib/agent/prompt.ts` |
