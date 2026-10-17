# DESIGN.md — Lehar HRMS

**Product:** Lehar (Hindi/Marathi for "wave", a nod to the Konkan coast)
**Company:** Konkan Coastal Foods · Panaji head office (HO) + Verna plant
**Screens:** see the Lehar design canvas (18 artboards). This document describes them and adds the user flows.

---

## 1. Design principles

1. **Zero clicks to the essentials.** Home shows the Check-in button and every leave balance without opening anything else.
2. **Numbers show their working.** Day counts list the weekly offs and holidays they skipped; balances split into opening, accrued, used and pending.
3. **Sensitive by default.** PAN, Aadhaar and bank numbers are always masked. Reveal is an HR-only, logged action. Aadhaar is never revealed.

---

## 2. User flows

### 2.1 Add employee (HR Admin)

```mermaid
flowchart TD
    A[HR clicks Add employee] --> B[Step 1: Personal details]
    B --> C{DOB makes employee 18+ on joining date?<br/>Mobile 10 digits starting 6-9?<br/>PIN 6 digits?}
    C -- No --> B1[Show error under the field] --> B
    C -- Yes --> D[Step 2: Job details<br/>designation, department, location, manager, grade]
    D --> E{Manager creates a loop?<br/>self, or someone who reports to them}
    E -- Yes --> D1[Block: invalid reporting manager] --> D
    E -- No --> F[Step 3: Statutory and bank<br/>PAN, Aadhaar, UAN, account, IFSC]
    F --> G{PAN, Aadhaar, IFSC valid?<br/>UAN optional}
    G -- No --> F1[Show error under the field] --> F
    G -- Yes --> H[Step 4: Emergency contact]
    H --> I[Step 5: Review]
    I --> J[Save]
    J --> K[System generates code KCF0183 - never changes]
    K --> L[Create leave balances<br/>CL and SL pro-rated, EL starts at 0]
    L --> M[Write audit log entry]
    M --> N[Employee can log in on joining date]
```

### 2.2 Check-in to day status

```mermaid
flowchart TD
    A[Employee opens Home] --> B[Clicks Check in]
    B --> C{Already has a record today?}
    C -- Yes --> C1[Show existing check-in, no new record]
    C -- No --> D[Save check-in time in IST<br/>WFH flag if ticked]
    D --> E{Check-in after 10:15?}
    E -- Yes --> E1[Mark Late]
    E1 --> E2{3rd Late this month?}
    E2 -- Yes --> E3[Add half-day LOP]
    E2 -- No --> F
    E -- No --> F[Employee clicks Check out]
    E3 --> F
    F --> G{Approved leave today?}
    G -- Yes --> S1[Status: On Leave]
    G -- No --> H{Hours worked}
    H -- 8 or more --> S2[Status: Present<br/>or WFH, counts as Present]
    H -- 4 to under 8 --> S3[Status: Half Day]
    H -- under 4 or no punch --> S4[Status: Absent]
    X[Nightly job for days with no record] --> Y{Weekly off for this location?<br/>Holiday for this location?}
    Y -- Weekly off --> S5[Status: Weekly Off]
    Y -- Holiday --> S6[Status: Holiday]
    Y -- Neither --> S4
```

### 2.3 Apply leave → approval → balance update

```mermaid
flowchart TD
    A[Employee opens Apply leave] --> B[Picks type, dates, full or half day, reason]
    B --> C{More than 30 days in the past?}
    C -- Yes --> C1[Block with message] --> B
    C -- No --> D[Count working days<br/>skip location weekly offs and holidays<br/>no sandwich rule]
    D --> E{SL over 2 days?}
    E -- Yes, no certificate --> E1[Ask for medical certificate] --> B
    E -- No / uploaded --> F{Enough balance?<br/>available = opening + accrued - used - pending}
    F -- No --> F1[Offer: convert extra days to LOP] --> G
    F -- Yes --> G[Submit: status Pending<br/>days held as pending, used unchanged]
    G --> H[Email manager]
    H --> I[Manager opens Approvals inbox<br/>sees balance and team clashes]
    I --> J{Manager is the applicant?}
    J -- Yes --> J1[Blocked: goes to their own manager]
    J -- No --> K{Approve or Reject with comment}
    K -- Approve --> L[Status Approved<br/>pending moves to used]
    K -- Reject --> M[Status Rejected<br/>pending released]
    L --> N[Email employee]
    M --> N
    N --> O{Employee cancels before leave starts?}
    O -- Yes --> P[Status Cancelled, balance restored]
```

### 2.4 Missed punch → regularisation

```mermaid
flowchart TD
    A[Employee sees Absent day on My attendance] --> B[Clicks the day, Request correction]
    B --> C[Enters correct check-in and check-out times + reason]
    C --> D[Request saved as Pending<br/>attendance NOT changed yet]
    D --> E[Appears in manager's Approvals inbox]
    E --> F{Manager decision}
    F -- Approve --> G[Update attendance times]
    G --> H[Recalculate status with day-status rules<br/>Present / Half Day / Late]
    F -- Reject --> I[Attendance stays as it was]
    H --> J[Notify employee]
    I --> J
    K[HR can correct directly] --> L[Must enter a reason, change is logged]
```

---

## 3. Screens

| Screen | Who sees it | What it shows | Canvas artboard |
|---|---|---|---|
| Home dashboard | Everyone | Check-in button, today's status, Late count, leave balances, my pending requests; managers also see team today and requests waiting on them | Home dashboard |
| My profile | Everyone | Tabs: Personal, Job, Statutory, Bank, Emergency contact. Contact fields editable; job fields locked; statutory/bank masked | My profile |
| My attendance | Everyone | Month calendar colour-coded by status, summary counts, day detail, regularisation request form | My attendance |
| Apply leave | Everyone | Leave type cards with balances, dates, full/half day, reason, certificate upload; working-day breakdown; LOP conversion offer; balance after approval; team clash note | Apply leave |
| My leave | Everyone | Balance cards, breakdown table (opening, accrued, used, pending, available), request history with Cancel | My leave |
| Ask HR | Everyone | Chat, tools used under each answer, draft card with Confirm / Edit / Discard, refusals | Ask HR |
| Approvals inbox | Managers, HR | Pending leave and correction requests, detail with balance before/after, clash warning, comment, Approve / Reject | Approvals inbox |
| Team attendance | Managers, HR | Today's counts and list, month grid for direct reports | Team attendance |
| Leave calendar | Managers, HR | Team leave on a month view, approved vs pending, clash days highlighted | Leave calendar |
| Reports | Managers (own team), HR (all) | Month-end summary table, filters, CSV download, check that rows add up | Reports |
| Employee directory | HR Admin | Search, filters, table, side panel with masked IDs, Reveal (logged), audit trail, Deactivate | Employee directory |
| Add / edit employee | HR Admin | 5-step form with validation on every Indian field; employee code shown as auto-assigned | Add employee |
| Settings | HR Admin | Locations and weekly offs, leave types, holidays per location (National / State / Optional), departments, policy text for Ask HR | Settings |

### Phone layouts
Check-in, Apply leave and Ask HR are designed at 390 × 844:
- **Check-in:** large clock, 60 px Check in button, WFH toggle, three balance tiles, this-week strip, bottom tab bar (Home, Attendance, Leave, Ask HR, Me).
- **Apply leave:** type chips with balances, date pickers, half-day toggle, day-by-day breakdown (Fri ✓, Sat off, Sun off, Mon ✓ = 2 days), sticky Submit button.
- **Ask HR:** full-height chat, draft card with Confirm, quick-question chips, input at the bottom.

On desktop screens, the sidebar stacks above the content at phone width and wide tables scroll inside their card.

---

## 4. Design system

### 4.1 Colour palette

| Token | Hex | Use |
|---|---|---|
| Konkan Teal | `#0B4F4A` | Primary buttons, sidebar, logo |
| Teal Tint | `#E2EFEC` | Active/selected backgrounds |
| Saffron | `#E8833A` | Logo wave and highlights only (never text) |
| Saffron Ink | `#9A4A12` | Small labels on light backgrounds |
| Ink | `#15212B` | Body text (15.6:1 on white) |
| Slate | `#55606A` | Secondary text (6.3:1 on white) |
| Sand | `#F4F3EE` | App background |
| Line | `#E3E1DA` | Borders and dividers |
| Danger | `#A32014` | Errors, Reject, destructive actions |

All text meets WCAG AA contrast (4.5:1).

### 4.2 Status colours (used identically on every screen)

| Status | Code | Text | Background | Rule |
|---|---|---|---|---|
| Present | P | `#17663F` | `#DDF1E5` | 8+ hours worked |
| Work from home | WFH | `#0B6476` | `#DCF0F4` | Counts as Present |
| Half Day | HD | `#8A5300` | `#FCEFCF` | 4 to under 8 hours |
| Absent | A | `#A32014` | `#FBE2DE` | Under 4 hours or no punch |
| On Leave | L | `#2A50A8` | `#E1E9FA` | Approved leave wins over punches |
| Holiday | H | `#6B2FA0` | `#EEE4F8` | Per location |
| Weekly Off | WO | `#4F5862` | `#ECEDEF` | HO Sat–Sun, Plant Sun |
| Late | LT | `#A3410A` | `#FFE6D2` | Check-in after 10:15 |

Every status always shows its label or code as well, so colour is never the only signal.

Request statuses: **Pending** (`#7A5200` on `#FFF1C7`), **Approved** (green), **Rejected** (red), **Cancelled** (grey), **Draft** (dashed blue outline, needs Confirm).

### 4.3 Typography
- **Manrope** for all interface text; **IBM Plex Mono** for employee codes, masked IDs and agent tool names.
- Scale: Display 32/40 800 · H1 24/32 800 · H2 17/24 700 · Body 14/22 400 · Caption 12.5/18 500.
- Numbers use tabular figures so columns line up.

### 4.4 Spacing and shape
- Spacing scale: 4, 8, 12, 16, 24, 32, 48 px.
- Radius: 6 px badges · 10 px inputs and buttons · 14–16 px cards · pill for status.
- Touch targets: at least 44 px high.

### 4.5 Components
- **Button:** Primary (teal), Secondary (outlined), Ghost (text), Destructive (red), Disabled (grey).
- **Form field:** label above, helper text below; error state = 2 px red border, red message explaining the correct format (e.g. "Use 5 letters, 4 digits, 1 letter, e.g. ABCDE1234F").
- **Masked field:** monospace value, lock icon; HR-only Reveal button (logged) for PAN and bank; none for Aadhaar.
- **Card:** white, 1 px Line border, 16 px radius, 20–24 px padding.
- **Balance card:** leave name + code, big available number, used/pending bar, one-line rule.
- **Table:** 12 px grey headers, 1 px row dividers, monospace codes; scrolls horizontally on small screens.
- **Status badge:** pill with status colours above.
- **Tool chip:** monospace tool name on a light grey chip under agent answers.
- **Draft card:** dashed blue border, "Draft · not submitted", Confirm / Edit / Discard.

---

## 5. Empty, loading and error states

| Screen | Empty | Loading | Error |
|---|---|---|---|
| Home dashboard | New joiner before first day: "Check-in and balances start on your first working day" + link to profile | Grey shapes matching the check-in card and three balance tiles | "Couldn't load your leave balances. Check-in still works." + Check in + Try again |
| Approvals inbox | "All caught up — you'll get an email when a new request arrives" | Three grey list rows | "Not approved — the balance changed since you opened this. Reload to see the latest." |
| Reports | "November hasn't started. Latest complete month is September." | "Building September summary… 113 of 182" with progress bar | "3 employees have unresolved days" with list + Resolve in Approvals / Download anyway |

---

## 6. Accessibility and responsiveness
- Real buttons, links, inputs and labels; icon-only buttons have `aria-label`.
- Errors use `role="alert"`; loading areas use `aria-busy`.
- All screens work at phone width; Check-in, Apply leave and Ask HR have dedicated phone layouts.
- All dates and times are shown in IST.
