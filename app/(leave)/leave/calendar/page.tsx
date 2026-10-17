import Link from "next/link";
import { requireManagerOrHr } from "@/lib/auth";
import { teamInScope } from "@/lib/attendance/queries";
import { leaveTypes, requestsFor } from "@/lib/leave/queries";
import { eachDate, MONTH_NAMES, monthParam, monthRange, parseMonthParam, shiftMonth } from "@/lib/dates";
import { PageHead } from "@/components/ui";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function LeaveCalendar({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const s = await requireManagerOrHr();
  const sp = await searchParams;
  const { year, month } = parseMonthParam(sp.month, s.today);
  const { from, to } = monthRange(year, month);
  const team = await teamInScope(s);
  const [reqs, types] = await Promise.all([requestsFor(team.map((t) => t.id), from, to), leaveTypes(false)]);
  const days = eachDate(from, to);
  const onDay = (d: string) => reqs.filter((r) => r.from_date <= d && r.to_date >= d);
  const firstDow = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7;
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const name = (id: string) => team.find((t) => t.id === id)?.full_name.split(" ")[0] ?? "";
  const code = (id: string) => types.find((t) => t.id === id)?.code ?? "";

  return (
    <div className="stack">
      <PageHead title="Leave calendar" sub={s.isHr ? "All employees" : "Your direct reports"}>
        <Link className="btn secondary small" href={`/leave/calendar?month=${monthParam(prev.year, prev.month)}`} aria-label="Previous month">‹</Link>
        <strong>{MONTH_NAMES[month - 1]} {year}</strong>
        <Link className="btn secondary small" href={`/leave/calendar?month=${monthParam(next.year, next.month)}`} aria-label="Next month">›</Link>
      </PageHead>
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <span className="badge st-L">Approved</span>
          <span className="badge rq-pending">Pending</span>
          <span className="badge" style={{ outline: "2px solid var(--danger)" }}>Clash: 2+ people off</span>
        </div>
        <div className="cal">
          {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} className="day empty" />)}
          {days.map((d) => {
            const list = onDay(d);
            return (
              <div key={d} className={`day${d === s.today ? " today" : ""}${list.length >= 2 ? " clash" : ""}`} aria-label={`${d}: ${list.length} on leave${list.length >= 2 ? ", clash" : ""}`}>
                <span className="n">{Number(d.slice(8))}</span>
                {list.map((r) => (
                  <span key={r.id} className={`badge ${r.status === "approved" ? "st-L" : "rq-pending"}`} style={{ padding: "0 6px", fontSize: 11 }}>
                    {name(r.employee_id)} {code(r.leave_type_id)}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
