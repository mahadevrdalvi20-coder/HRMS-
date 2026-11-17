# Lehar HRMS — screen designs

Mockups for approval, covering the existing modules (Employee Master, Attendance, Leave, Reports, Ask HR) and two **proposed** modules: **Recruitment (ATS)** and **Performance (PMS)**. They follow the design system in [`DESIGN.md`](../../DESIGN.md) (Konkan Teal, Saffron, Manrope). All names and numbers are sample data.

> Recruitment and Performance are designs only. They are not built in the app yet, and the requirement document lists them as out of scope for the graded build. Record the decision in `ARCHITECTURE.md` before building them.

## Core HR

| Home dashboard | Employee directory (HR) |
|---|---|
| ![Home](screens/Main.png) | ![Directory](screens/Directory.png) |
| **My profile** | **My attendance** |
| ![Profile](screens/Profile.png) | ![Attendance](screens/Attendance.png) |

## Leave & reports

| Apply leave | Approvals inbox |
|---|---|
| ![Apply leave](screens/ApplyLeave.png) | ![Approvals](screens/Approvals.png) |
| **Month-end report** | |
| ![Reports](screens/Reports.png) | |

## Recruitment (ATS) — proposed

| Hiring pipeline | Candidate & offer |
|---|---|
| ![Recruitment](screens/Recruitment.png) | ![Candidate](screens/Candidate.png) |

## Performance (PMS) — proposed

| My goals & self-review | Calibration (HR) |
|---|---|
| ![Performance](screens/Performance.png) | ![Calibration](screens/Calibration.png) |

## Ask HR & phone

| Ask HR agent | Phone check-in |
|---|---|
| ![Ask HR](screens/AskHR.png) | <img src="screens/PhoneCheckin.png" width="300" alt="Phone check-in"> |

## Opening the source files

Each screen is a `*.dc.html` file. `support.js` renders them in a normal browser. Serve the folder, because the sidebar is loaded from `Sidebar.dc.html`:

```bash
npx serve docs/design
```

Then open `http://localhost:3000/Main.dc.html`; the sidebar links move between screens.
