import Link from "next/link";
import { requireManagerOrHr } from "@/lib/auth";
import { monthsFor, teamInScope, teamToday } from "@/lib/attendance/queries";
import { formatDate, formatISTTime, MONTH_NAMES, monthParam, parseMonthParam, shiftMonth } from "@/lib/dates";
import { StatusBadge, StatusLegend } from "@/components/StatusBadge";
import { HrCorrectForm } from "@/components/attendance/HrCorrectForm";
import { PageHead, Empty } from "@/components/ui";

export default async function TeamAttendance({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const s = await requireManagerOrHr();
  const sp = await searchParams;
  const team = await teamInScope(s);
  const { year, month } = parseMonthParam(sp.month, s.today);
  const [today, months] = await Promise.all([teamToday(team, s.today), monthsFor(team, year, month, s.today)]);
  const present = today.filter((t) => t.day.inProgress || ["P", "WFH", "HD"].includes(t.day.status));
  const onLeave = today.filter((t) => t.day.status === "L");
  const off = today.filter((t) => ["H", "WO"].includes(t.day.status));
  const notIn = today.filter((t) => !t.day.inProgress && ["A", "NONE"].includes(t.day.status));
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div className="stack">
      <PageHead title="Team attendance" sub={s.isHr ? "All active employees (HR)" : "Your direct reports"} />
      {team.length === 0 ? <div className="card"><Empty>No one reports to you.</Empty></div> : (
        <>
          <div className="grid grid-4">
            <div className="card tight stat"><span className="badge st-P" style={{ alignSelf: "flex-start" }}>Present</span><span className="v">{present.length}</span></div>
            <div className="card tight stat"><span className="badge st-L" style={{ alignSelf: "flex-start" }}>On leave</span><span className="v">{onLeave.length}</span></div>
            <div className="card tight stat"><span className="badge st-A" style={{ alignSelf: "flex-start" }}>Not checked in / absent</span><span className="v">{notIn.length}</span></div>
            <div className="card tight stat"><span className="badge st-WO" style={{ alignSelf: "flex-start" }}>Off today</span><span className="v">{off.length}</span></div>
          </div>

          <div className="card">
            <h2>Today · {formatDate(s.today)}</h2>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Code</th><th>Name</th><th>Location</th><th>Status</th><th>In</th><th>Out</th></tr></thead>
                <tbody>
                  {today.map((t) => (
                    <tr key={t.employee.id}>
                      <td className="mono">{t.employee.employee_code}</td>
                      <td>{t.employee.full_name}</td>
                      <td>{t.location?.name}</td>
                      <td>
                        {t.day.inProgress ? <span className="badge st-P">Checked in</span> : t.day.status === "NONE" ? <span className="badge st-NONE">Not checked in</span> : <StatusBadge status={t.day.status} />}
                        {t.day.late && <> <StatusBadge status="LT" /></>}
                      </td>
                      <td>{formatISTTime(t.day.checkIn)}</td>
                      <td>{formatISTTime(t.day.checkOut)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Month grid · {MONTH_NAMES[month - 1]} {year}</h2>
              <div className="row">
                <Link className="btn secondary small" href={`/attendance/team?month=${monthParam(prev.year, prev.month)}`} aria-label="Previous month">‹</Link>
                <Link className="btn secondary small" href={`/attendance/team?month=${monthParam(next.year, next.month)}`} aria-label="Next month">›</Link>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    {months[0]?.days.map((d) => <th key={d.date} className="num">{Number(d.date.slice(8))}</th>)}
                    <th className="num">P</th><th className="num">L</th><th className="num">A</th><th className="num">LT</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.employee.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{m.employee.full_name}</td>
                      {m.days.map((d) => (
                        <td key={d.date} style={{ padding: 2, textAlign: "center" }}>
                          {d.inProgress ? <span className="badge st-P" style={{ padding: "0 4px" }}>In</span> : d.status !== "NONE" && <span className={`badge st-${d.status}`} style={{ padding: "0 4px" }} title={d.date}>{d.status}</span>}
                        </td>
                      ))}
                      <td className="num">{m.summary.present + m.summary.wfh + m.summary.halfDay * 0.5}</td>
                      <td className="num">{m.summary.leave}</td>
                      <td className="num">{m.summary.absent}</td>
                      <td className="num">{m.summary.late}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt"><StatusLegend /></div>
          </div>
        </>
      )}

      {s.isHr && (
        <div className="card">
          <h2>HR correction</h2>
          <p className="muted">Directly set times for a day. A reason is required and the change is logged.</p>
          <HrCorrectForm today={s.today} employees={team.map((e) => ({ id: e.id, label: `${e.full_name} (${e.employee_code})` }))} />
        </div>
      )}
    </div>
  );
}
