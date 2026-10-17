import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getBalances, myRequests } from "@/lib/leave/queries";
import { canCancel } from "@/lib/leave/rules";
import { formatDate, yearOf } from "@/lib/dates";
import { BalanceCard } from "@/components/leave/BalanceCard";
import { CancelButton } from "@/components/leave/CancelButton";
import { PageHead, RequestBadge, Empty } from "@/components/ui";

export default async function MyLeave({ searchParams }: { searchParams: Promise<{ submitted?: string; year?: string }> }) {
  const s = await requireSession();
  const sp = await searchParams;
  const year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : yearOf(s.today);
  const [balances, requests] = await Promise.all([getBalances(s.employee, year, s.today), myRequests(s.employeeId)]);
  const visible = balances.filter((b) => b.eligible);

  return (
    <div className="stack">
      <PageHead title="My leave" sub={`Leave year ${year} (Jan–Dec)`}>
        <Link className="btn" href="/leave/apply">Apply leave</Link>
      </PageHead>
      {sp.submitted && <div className="alert ok" role="status">Leave submitted. It shows as Pending until your manager decides. Pending days are held, your used balance does not change yet.</div>}

      <div className="grid grid-3">{visible.map((b) => <BalanceCard key={b.type.id} b={b} />)}</div>

      <div className="card">
        <h2>Balance breakdown</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Type</th><th className="num">Opening</th><th className="num">Accrued</th><th className="num">Used</th><th className="num">Pending</th><th className="num">Available</th></tr></thead>
            <tbody>
              {visible.map((b) => (
                <tr key={b.type.id}>
                  <td>{b.type.name} <span className="chip">{b.type.code}</span></td>
                  <td className="num">{b.opening}</td>
                  <td className="num">{b.accrued === null ? "—" : b.accrued}</td>
                  <td className="num">{b.used}</td>
                  <td className="num">{b.pending}</td>
                  <td className="num"><strong>{b.available === null ? "Unlimited" : b.available}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="caption mt">Available = opening + accrued − used − pending. It is calculated every time, never stored.</p>
      </div>

      <div className="card">
        <h2>Request history</h2>
        {requests.length === 0 ? <Empty>No leave requests yet.</Empty> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Type</th><th>Dates</th><th className="num">Days</th><th>Reason</th><th>Status</th><th>Decision</th><th /></tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td><span className="chip">{r.type?.code}</span></td>
                    <td>{formatDate(r.from_date)}{r.to_date !== r.from_date && <> – {formatDate(r.to_date)}</>}{r.is_half_day && " (½)"}</td>
                    <td className="num">{r.days}</td>
                    <td>{r.reason}</td>
                    <td><RequestBadge status={r.status} /></td>
                    <td>{r.approver_name ? `${r.approver_name}${r.approver_comment ? `: ${r.approver_comment}` : ""}` : ""}</td>
                    <td>{canCancel(r, s.employeeId, s.today) && <CancelButton id={r.id} />}</td>
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
