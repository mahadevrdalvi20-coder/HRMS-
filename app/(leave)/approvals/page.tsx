import { requireManagerOrHr } from "@/lib/auth";
import { approvalDetails } from "@/lib/approvals/queries";
import { formatDate, formatISTDateTime, formatISTTime } from "@/lib/dates";
import { DecisionPanel } from "@/components/approvals/DecisionPanel";
import { PageHead, RequestBadge } from "@/components/ui";

export default async function Approvals() {
  const s = await requireManagerOrHr();
  const { leave, regularisation } = await approvalDetails(s);
  const total = leave.length + regularisation.length;
  return (
    <div className="stack">
      <PageHead title="Approvals" sub={s.isHr ? "All employees' requests (HR). Your own requests go to your manager." : "Your direct reports' requests"} />
      {total === 0 && (
        <div className="card"><h2>All caught up</h2><p className="muted">You&apos;ll get an email when a new request arrives.</p></div>
      )}

      {leave.length > 0 && <h2>Leave ({leave.length})</h2>}
      {leave.map((x) => (
        <div key={x.request.id} className="card">
          <div className="card-head">
            <div>
              <strong>{x.employee.full_name}</strong> <span className="mono muted">{x.employee.employee_code}</span>
              <div className="muted">{x.type?.name} · {formatDate(x.request.from_date)}{x.request.to_date !== x.request.from_date && ` – ${formatDate(x.request.to_date)}`}{x.request.is_half_day && " (half day)"}</div>
            </div>
            <RequestBadge status="pending" />
          </div>
          <div className="grid grid-2">
            <dl className="kv">
              <dt>Working days</dt><dd>{x.request.days}</dd>
              <dt>Reason</dt><dd>{x.request.reason}</dd>
              <dt>Balance now</dt><dd>{x.availableNow === null ? "Unlimited" : x.availableNow}</dd>
              <dt>After approval</dt><dd>{x.availableAfter === null ? "—" : x.availableAfter}{x.availableAfter !== null && x.availableAfter < 0 && <span className="err"> · not enough balance</span>}</dd>
              <dt>Applied</dt><dd>{formatISTDateTime(x.request.created_at)}</dd>
            </dl>
            <div className="stack">
              {x.clashes.length > 0 ? (
                <div className="alert warn">Clash: {x.clashes.map((c) => `${c.name} (${formatDate(c.from)}${c.to !== c.from ? ` – ${formatDate(c.to)}` : ""}, ${c.status})`).join("; ")}</div>
              ) : (
                <div className="caption">No one else in the team is on leave on these dates.</div>
              )}
              <DecisionPanel kind="leave" id={x.request.id} hasCertificate={!!x.request.attachment_url} />
            </div>
          </div>
        </div>
      ))}

      {regularisation.length > 0 && <h2>Attendance corrections ({regularisation.length})</h2>}
      {regularisation.map((x) => (
        <div key={x.request.id} className="card">
          <div className="card-head">
            <div>
              <strong>{x.employee.full_name}</strong> <span className="mono muted">{x.employee.employee_code}</span>
              <div className="muted">{formatDate(x.request.date)} · {formatISTTime(x.request.requested_in)}–{formatISTTime(x.request.requested_out)} IST</div>
            </div>
            <RequestBadge status="pending" />
          </div>
          <div className="grid grid-2">
            <dl className="kv"><dt>Reason</dt><dd>{x.request.reason}</dd><dt>Raised</dt><dd>{formatISTDateTime(x.request.created_at)}</dd></dl>
            <DecisionPanel kind="regularisation" id={x.request.id} />
          </div>
        </div>
      ))}
    </div>
  );
}
