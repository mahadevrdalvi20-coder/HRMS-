import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { myMonth, myRegularisations } from "@/lib/attendance/queries";
import { formatDate, formatISTTime, formatISTDateTime, MONTH_NAMES, monthParam, parseMonthParam, shiftMonth, isValidISODate } from "@/lib/dates";
import { STATUS_META } from "@/lib/attendance/rules";
import { MonthCalendar } from "@/components/attendance/MonthCalendar";
import { RegularisationForm } from "@/components/attendance/RegularisationForm";
import { StatusBadge, StatusLegend } from "@/components/StatusBadge";
import { PageHead, RequestBadge } from "@/components/ui";

export default async function MyAttendance({ searchParams }: { searchParams: Promise<{ month?: string; day?: string }> }) {
  const s = await requireSession();
  const sp = await searchParams;
  const { year, month } = parseMonthParam(sp.month, s.today);
  const [m, regs] = await Promise.all([myMonth(s.employee, year, month, s.today), myRegularisations(s.employeeId)]);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const mp = monthParam(year, month);
  const selected = sp.day && isValidISODate(sp.day) ? m.days.find((d) => d.date === sp.day) : undefined;
  const sum = m.summary;
  const canRequest = selected && selected.date <= s.today && ["A", "HD", "P", "WFH"].includes(selected.status) || (selected?.inProgress ?? false);

  return (
    <div className="stack">
      <PageHead title="My attendance" sub={`${s.location.name} · weekly off: ${s.location.weekly_off_days.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(" + ")}`}>
        <Link className="btn secondary small" href={`/attendance?month=${monthParam(prev.year, prev.month)}`} aria-label="Previous month">‹</Link>
        <strong>{MONTH_NAMES[month - 1]} {year}</strong>
        <Link className="btn secondary small" href={`/attendance?month=${monthParam(next.year, next.month)}`} aria-label="Next month">›</Link>
      </PageHead>

      <div className="grid grid-4">
        {([["Present", sum.present, "P"], ["WFH", sum.wfh, "WFH"], ["Half Day", sum.halfDay, "HD"], ["Absent", sum.absent, "A"], ["On Leave", sum.leave, "L"], ["Holidays", sum.holiday, "H"], ["Late", sum.late, "LT"], ["Late LOP", sum.lateLopDays, "A"]] as const).map(([label, v, st]) => (
          <div key={label} className="card tight stat">
            <span className={`badge ${STATUS_META[st].cls}`} style={{ alignSelf: "flex-start" }}>{label}</span>
            <span className="v">{v}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head"><h2>Calendar</h2><span className="caption">Tap a day for details or to request a correction</span></div>
        <MonthCalendar days={m.days} today={s.today} selected={selected?.date} hrefFor={(d) => `/attendance?month=${mp}&day=${d}`} />
        <div className="mt"><StatusLegend /></div>
      </div>

      {selected && (
        <div className="card" id="day">
          <div className="card-head">
            <h2>{formatDate(selected.date)}</h2>
            {selected.inProgress ? <span className="badge st-P">Checked in</span> : <StatusBadge status={selected.status} />}
          </div>
          <dl className="kv">
            <dt>Check-in</dt><dd>{formatISTTime(selected.checkIn)}{selected.late && " · Late"}</dd>
            <dt>Check-out</dt><dd>{formatISTTime(selected.checkOut)}</dd>
            <dt>Hours</dt><dd>{selected.hours !== null ? selected.hours.toFixed(2) : "—"}</dd>
            {selected.holiday && (<><dt>Holiday</dt><dd>{selected.holiday.name} ({selected.holiday.type})</dd></>)}
            {selected.leave && (<><dt>Leave</dt><dd>{selected.leave.code}{selected.leave.isHalfDay ? " (half day)" : ""}</dd></>)}
            {selected.regularised && (<><dt>Note</dt><dd>Corrected after approval</dd></>)}
            {selected.lateLop && (<><dt>LOP</dt><dd>0.5 day (3rd Late this month)</dd></>)}
          </dl>
          {canRequest && (
            <>
              <h3 className="mt">Request correction</h3>
              <RegularisationForm
                date={selected.date}
                defaultIn={selected.checkIn ? formatISTTime(selected.checkIn) : "09:30"}
                defaultOut={selected.checkOut ? formatISTTime(selected.checkOut) : "18:00"}
              />
            </>
          )}
        </div>
      )}

      <div className="card">
        <h2>My correction requests</h2>
        {regs.length === 0 ? <p className="muted">No correction requests.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Day</th><th>Requested times</th><th>Reason</th><th>Status</th><th>Comment</th><th>Raised</th></tr></thead>
              <tbody>
                {regs.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date)}</td>
                    <td>{formatISTTime(r.requested_in)}–{formatISTTime(r.requested_out)}</td>
                    <td>{r.reason}</td>
                    <td><RequestBadge status={r.status} /></td>
                    <td>{r.approver_comment ?? ""}</td>
                    <td>{formatISTDateTime(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
