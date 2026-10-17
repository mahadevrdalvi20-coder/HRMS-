# RESEARCH.md — Lehar HRMS

> Owner's note: sections 1–7 are research notes to start from. The course requires these answers **in your own words** and question 8 is your own interview — rewrite and complete them before submission. Section 9 (the leave policy as rules) is what the code implements; if you change a rule, change it here and in the Decision log of ARCHITECTURE.md.

## 1. Employee details an Indian HR team keeps
- **Personal:** full name, date of birth, gender, mobile, personal email, address with PIN code and state, emergency contact.
- **Job:** employee code, designation, department, location, reporting manager, grade, date of joining, last working day on exit.
- **Statutory (mandatory):** PAN (income-tax/TDS, Form 16), Aadhaar (KYC, EPFO UAN linking), UAN (EPF, for PF-eligible employees; new joiners may not have one yet).
- **Bank:** account number, IFSC, bank name (salary credit).
- **Sensitive:** Aadhaar (Aadhaar Act 2016 and UIDAI rules restrict display/storage; show only the last 4 digits), PAN, bank account. Under the Digital Personal Data Protection Act 2023 these are personal data that must be protected and accessed only for the stated purpose.

## 2. Employee codes
Usually a company prefix + running number (e.g. `KCF0183`). The code must never change because payroll, PF returns, attendance devices, old payslips and audit trails all refer to it; changing it breaks the link between historical records. Names and emails change, codes do not.

## 3. Leave types
- **CL** (casual), **SL** (sick), **EL/PL** (earned/privilege), **Maternity**, **Paternity**, **LOP** (loss of pay), **Comp-off** (for working on an off day).
- **Statutory entitlement** = required by law (e.g. maternity under the Maternity Benefit Act, earned leave under the state Shops and Establishments Act / Factories Act). **Company policy** = anything the employer adds (paternity in the private sector, extra CL, etc.).

## 4. Accrual and year end
- Upfront credit on 1 Jan (common for CL/SL), monthly accrual (common for EL: 1.25/month = 15/year), or pro-rated credit for mid-year joiners.
- At year end unused leave either **lapses** (CL/SL), is **carried forward** up to a cap (EL, e.g. 30), or is **encashed** (paid out, usually at exit).

## 5. Goa Shops and Establishments Act
Goa, Daman and Diu Shops and Establishments Act, 1973 (as amended): limits normal working hours (9 hours a day / 48 a week), requires a weekly holiday, rest intervals, and annual leave with wages. *Verify the exact current figures from the Act / Goa Labour Department before submission and cite the section.*

## 6. Holidays
- **National:** Republic Day (26 Jan), Independence Day (15 Aug), Gandhi Jayanti (2 Oct) — compulsory everywhere.
- **State:** declared by the state government (e.g. Goa Liberation Day 19 Dec, Goa Statehood Day 30 May).
- **Optional / restricted:** a list from which an employee may pick a fixed number.

## 7. Late, half day, WFH, missed punch
Companies set a grace time (here 10:15). Repeated lates convert to LOP (here every 3 Lates = ½ day LOP). Hours worked below a threshold give Half Day or Absent. WFH is usually marked and counted as present. A missed punch is fixed through a regularisation request approved by the manager.

## 8. Interview
*TODO — your own interview with a working professional: what HR system they use, what they like, what they dislike.*

## 9. Leave and attendance policy implemented (rules)

### Attendance
1. All times are stored as absolute instants and shown in IST (Asia/Kolkata).
2. Head office (Panaji): Mon–Fri; weekly off Sat + Sun. Plant (Verna): Mon–Sat; weekly off Sun.
3. Hours = check-out − check-in. ≥ 8 h ⇒ **Present**; 4 h to < 8 h ⇒ **Half Day**; < 4 h, no check-out on a past day, or no punch ⇒ **Absent**.
4. WFH day with ≥ 8 h ⇒ **WFH**, counts as Present.
5. Check-in strictly after 10:15:00 IST ⇒ **Late**. Every 3rd Late in a calendar month (3rd, 6th, …) ⇒ 0.5 day LOP.
6. Priority: approved leave ⇒ **On Leave** (even if punched) > location holiday ⇒ **Holiday** > location weekly off ⇒ **Weekly Off** > punches.
   National and State holidays are days off; **Optional** holidays are listed but remain working days (use CL to take one).
7. One attendance row per employee per date.
8. A regularisation request changes attendance only after manager (or HR) approval. HR may correct directly with a mandatory reason that is logged.

### Leave
| Type | Quota | Accrual | Carry forward | Half day |
|---|---|---|---|---|
| CL | 8 | credited 1 Jan; joiners pro-rated | lapses 31 Dec | yes |
| SL | 7 | credited 1 Jan; joiners pro-rated | lapses 31 Dec | yes |
| EL | 15 | 1.25 per completed month of service in the year | up to 30 | no |
| Maternity | 182 calendar days (26 weeks) | on request | n/a | no |
| Paternity | 5 | on request | n/a | no |
| LOP | unlimited | n/a | n/a | yes |

1. Leave year = 1 Jan to 31 Dec. A request must stay inside one year.
2. **Pro-rating (CL/SL):** months counted from the joining month (if joined on or before the 15th) or the next month (after the 15th) to December; credit = quota × months / 12, rounded to the nearest 0.5. A 1 July joiner gets CL 4, SL 3.5.
3. **EL accrual:** 1.25 × completed months since the later of 1 Jan and the joining date, capped at 15 per year.
4. **Available** = opening + accrued − used − pending. Never stored.
5. Leave days count **working days only** at the employee's location: weekly offs and location holidays inside the range are skipped. **No sandwich rule** — a sandwich rule (used by some companies) counts weekends/holidays between two leave days as leave; Konkan does not. Friday–Monday at Panaji = 2 days.
6. Maternity is counted in calendar days because the Act grants weeks.
7. If requested days exceed available, the request cannot be submitted as is; the app offers to convert the excess to LOP (the earliest working days use the balance, the rest become a separate LOP request).
8. SL of more than 2 days needs a medical certificate upload.
9. Leave cannot start more than 30 days before today.
10. Half day only for types that allow it, only for a single date (0.5 day).
11. Approval: the direct manager, or HR. Nobody can approve their own request. Pending days are held (counted in `pending`); `used` changes only on approval.
12. Employees can cancel pending leave, or approved leave that has not started; the balance is restored.
13. Maternity is available to female employees, paternity to male employees.

## 10. Sources
- Maternity Benefit (Amendment) Act, 2017 — 26 weeks for the first two children: https://labour.gov.in/sites/default/files/Maternity%20Benefit%20Amendment%20Act%2C2017%20.pdf
- Goa, Daman and Diu Shops and Establishments Act, 1973: https://www.goa.gov.in/department/labour/
- Aadhaar (Targeted Delivery…) Act, 2016 and UIDAI masked Aadhaar guidance: https://uidai.gov.in/
- Digital Personal Data Protection Act, 2023: https://www.meity.gov.in/data-protection-framework
- EPFO UAN: https://www.epfindia.gov.in/
- Income Tax PAN structure: https://www.incometax.gov.in/
- RBI IFSC format: https://www.rbi.org.in/Scripts/IFSCMICRDetails.aspx
- Gemini API free-tier limits: https://ai.google.dev/gemini-api/docs/rate-limits
