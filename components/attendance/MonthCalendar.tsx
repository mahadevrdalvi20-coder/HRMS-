import Link from "next/link";
import type { MonthDay } from "@/lib/attendance/month";
import { formatISTTime } from "@/lib/dates";
import { StatusBadge } from "@/components/StatusBadge";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthCalendar({ days, today, hrefFor, selected }: { days: MonthDay[]; today: string; hrefFor?: (date: string) => string; selected?: string }) {
  const firstDow = (new Date(`${days[0].date}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday first
  return (
    <div className="cal" role="grid" aria-label="Month calendar">
      {DOW.map((d) => <div key={d} className="dow" role="columnheader">{d}</div>)}
      {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} className="day empty" aria-hidden="true" />)}
      {days.map((d) => {
        const n = Number(d.date.slice(8));
        const body = (
          <>
            <span className="n">{n}</span>
            {d.inProgress ? <span className="badge st-P">In</span> : <StatusBadge status={d.status} short />}
            {d.late && !["L", "H", "WO"].includes(d.status) && <span className="badge st-LT">LT</span>}
            {d.lateLop && <span className="caption" style={{ color: "var(--danger)" }}>½ LOP</span>}
            {d.holiday && <span className="caption" title={d.holiday.name}>{d.holiday.type === "Optional" ? "Opt: " : ""}{d.holiday.name}</span>}
            {d.leave && d.status === "L" && <span className="caption">{d.leave.code}{d.leave.isHalfDay ? " ½" : ""}</span>}
            {d.checkIn && !["L"].includes(d.status) && <span className="caption">{formatISTTime(d.checkIn)}–{d.checkOut ? formatISTTime(d.checkOut) : "?"}</span>}
          </>
        );
        const cls = `day${d.date === today ? " today" : ""}${selected === d.date ? " selected" : ""}`;
        return hrefFor ? (
          <Link key={d.date} href={hrefFor(d.date)} className={cls} role="gridcell" aria-label={`${d.date}`}>{body}</Link>
        ) : (
          <div key={d.date} className={cls} role="gridcell">{body}</div>
        );
      })}
    </div>
  );
}
