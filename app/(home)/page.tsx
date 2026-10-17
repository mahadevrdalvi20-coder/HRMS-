import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { myMonth, teamInScope, teamToday, todayRecord } from "@/lib/attendance/queries";
import { getBalances, myRequests } from "@/lib/leave/queries";
import { pendingForApprover } from "@/lib/approvals/queries";
import { formatDate, formatISTTime, monthOf, yearOf } from "@/lib/dates";
import { STATUS_META } from "@/lib/attendance/rules";
import { CheckInCard } from "@/components/attendance/CheckInCard";
import { BalanceCard } from "@/components/leave/BalanceCard";
import { RequestBadge } from "@/components/ui";

export default async function Home() {
  const s = await requireSession();
  const first = s.employee.full_name.split(" ")[0];
  const notStarted = s.today < s.employee.date_of_joining;

  if (notStarted) {
    return (
      <div className="card" style={{ maxWidth: 560 }}>
        <h1>Welcome to Konkan Coastal Foods, {first}</h1>
        <p>Check-in and balances start on your first working day, {formatDate(s.employee.date_of_joining)}.</p>
        <Link className="btn secondary" href="/profile">Check your profile</Link>
      </div>
    );
  }

  const [rec, month] = await Promise.all([todayRecord(s.employeeId, s.today), myMonth(s.employee, yearOf(s.today), monthOf(s.today), s.today)]);
  const todayDay = month.days.find((d) => d.date === s.today);
  const statusLabel = todayDay?.inProgress ? "Checked in" : todayDay && todayDay.status !== "NONE" ? STATUS_META[todayDay.status].label : "Not checked in";
  const offReason = todayDay?.status === "H" ? `Today is a holiday: ${todayDay.holiday?.name}.` : todayDay?.status === "WO" ? "Today is your weekly off." : todayDay?.status === "L" ? "You are on approved leave today." : undefined;

  let balancesError = false;
  let balances: Awaited<ReturnType<typeof getBalances>> = [];
  try {
    balances = (await getBalances(s.employee, yearOf(s.today), s.today)).filter((b) => b.eligible && ["CL", "SL", "EL"].includes(b.type.code));
  } catch {
    balancesError = true;
  }
  const [requests, waiting, team] = await Promise.all([
    myRequests(s.employeeId),
    s.isHr || s.isManager ? pendingForApprover(s) : Promise.resolve({ leave: [], regularisation: [] }),
    s.isManager || s.isHr ? teamInScope(s).then((t) => teamToday(t, s.today)) : Promise.resolve([]),
  ]);
  const myPending = requests.filter((r) => r.status === "pending");
  const waitingCount = waiting.leave.length + waiting.regularisation.length;

  return (
    <div className="stack">
      <div>
        <h1>Good day, {first}</h1>
        <div className="muted">{formatDate(s.today)} · {s.location.name}</div>
      </div>

      <div className="grid grid-2">
        <CheckInCard
          checkInTime={rec?.check_in ? formatISTTime(rec.check_in) : null}
          checkOutTime={rec?.check_out ? formatISTTime(rec.check_out) : null}
          isWfh={rec?.is_wfh ?? false}
          statusLabel={statusLabel}
          disabledReason={!rec?.check_in ? offReason : undefined}
        />
        <div className="card stack">
          <h2>This month</h2>
          <div className="grid grid-3">
            <div className="stat"><span className="badge st-P" style={{ alignSelf: "flex-start" }}>Present</span><span className="v">{month.summary.present + month.summary.wfh}</span></div>
            <div className="stat"><span className="badge st-LT" style={{ alignSelf: "flex-start" }}>Late</span><span className="v">{month.summary.late}</span></div>
            <div className="stat"><span className="badge st-A" style={{ alignSelf: "flex-start" }}>Absent</span><span className="v">{month.summary.absent}</span></div>
          </div>
          {month.summary.late > 0 && <p className="caption">Every 3 Lates in a month = ½ day LOP. {month.summary.late % 3 === 2 ? "One more Late this month adds ½ day LOP." : ""}</p>}
          <Link href="/attendance" className="caption">Open my attendance →</Link>
        </div>
      </div>

      {balancesError ? (
        <div className="alert error" role="alert">Couldn&apos;t load your leave balances. Check-in still works. <Link href="/">Try again</Link></div>
      ) : (
        <div className="grid grid-3">{balances.map((b) => <BalanceCard key={b.type.id} b={b} />)}</div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head"><h2>My pending requests</h2><Link className="btn small secondary" href="/leave/apply">Apply leave</Link></div>
          {myPending.length === 0 ? <p className="muted">Nothing pending.</p> : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {myPending.map((r) => <li key={r.id}>{r.type?.code} · {formatDate(r.from_date)}{r.to_date !== r.from_date ? ` – ${formatDate(r.to_date)}` : ""} · {r.days}d <RequestBadge status={r.status} /></li>)}
            </ul>
          )}
        </div>
        {(s.isManager || s.isHr) && (
          <div className="card">
            <div className="card-head"><h2>Team today</h2><Link className="btn small secondary" href="/approvals">Approvals ({waitingCount})</Link></div>
            <div className="row">
              <span className="badge st-P">Present {team.filter((t) => t.day.inProgress || ["P", "WFH", "HD"].includes(t.day.status)).length}</span>
              <span className="badge st-L">On leave {team.filter((t) => t.day.status === "L").length}</span>
              <span className="badge st-A">Not in {team.filter((t) => !t.day.inProgress && ["A", "NONE"].includes(t.day.status)).length}</span>
            </div>
            <p className="caption mt">{waitingCount ? `${waitingCount} request(s) waiting on you.` : "All caught up."} <Link href="/attendance/team">Team attendance →</Link></p>
          </div>
        )}
      </div>
    </div>
  );
}
