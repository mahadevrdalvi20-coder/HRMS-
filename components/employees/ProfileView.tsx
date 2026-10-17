import Link from "next/link";
import type { Session } from "@/lib/auth";
import { getAuditTrail, type Profile } from "@/lib/employees/queries";
import { formatDate, formatISTDateTime } from "@/lib/dates";
import { isActiveOn } from "@/lib/auth/rules";
import { ContactForm } from "./ContactForm";
import { RevealButton } from "./RevealButton";
import { DeactivatePanel } from "./DeactivatePanel";

const TABS = [
  ["personal", "Personal"],
  ["job", "Job"],
  ["statutory", "Statutory"],
  ["bank", "Bank"],
  ["emergency", "Emergency contact"],
] as const;

export async function ProfileView({ session, profile, tab, basePath, saved }: { session: Session; profile: Profile; tab: string; basePath: string; saved?: string }) {
  const { employee: e } = profile;
  const isSelf = session.employeeId === e.id;
  const hr = session.isHr;
  const active = isActiveOn(e, session.today);
  const current = TABS.some(([k]) => k === tab) ? tab : "personal";
  const contact = {
    mobile: e.mobile, address_line: e.address_line ?? "", city: e.city ?? "", state: e.state ?? "Goa", pin_code: e.pin_code ?? "",
    emergency_name: e.emergency_name ?? "", emergency_relation: e.emergency_relation ?? "", emergency_mobile: e.emergency_mobile ?? "",
  };
  const audit = hr ? await getAuditTrail(e.id) : [];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{e.full_name}</h1>
          <div className="row muted">
            <span className="mono">{e.employee_code}</span>
            <span>· {e.designation}</span>
            <span>· {profile.location.name}</span>
            {!active && <span className="badge st-A">Inactive</span>}
            {e.is_hr_admin && <span className="badge st-L">HR Admin</span>}
          </div>
        </div>
        {hr && (
          <div className="row">
            <Link className="btn secondary" href={`/employees/${e.id}/edit`}>Edit employee</Link>
          </div>
        )}
      </div>
      {saved && <div className="alert ok" role="status">{saved}</div>}

      <div className="card">
        <nav className="tabs" aria-label="Profile sections">
          {TABS.map(([k, label]) => (
            <Link key={k} href={`${basePath}?tab=${k}`} aria-current={current === k ? "page" : undefined}>{label}</Link>
          ))}
        </nav>

        {current === "personal" && (
          <div className="stack">
            <dl className="kv">
              <dt>Email</dt><dd>{e.email}</dd>
              <dt>Date of birth</dt><dd>{formatDate(e.dob)}</dd>
              <dt>Gender</dt><dd>{e.gender}</dd>
            </dl>
            {(isSelf || hr) && (
              <>
                <h2 className="mt">Contact details {isSelf && <span className="caption">(you can edit these)</span>}</h2>
                <ContactForm employeeId={e.id} initial={contact} section="contact" />
              </>
            )}
          </div>
        )}

        {current === "job" && (
          <div className="stack">
            {!hr && <div className="alert info">Job details are managed by HR. Contact HR if something is wrong.</div>}
            <dl className="kv">
              <dt>Employee code</dt><dd className="mono">{e.employee_code}</dd>
              <dt>Designation</dt><dd>{e.designation}</dd>
              <dt>Grade</dt><dd>{e.grade ?? "—"}</dd>
              <dt>Department</dt><dd>{profile.department.name}</dd>
              <dt>Location</dt><dd>{profile.location.name}</dd>
              <dt>Reporting manager</dt><dd>{profile.manager ? `${profile.manager.full_name} (${profile.manager.employee_code})` : "—"}</dd>
              <dt>Date of joining</dt><dd>{formatDate(e.date_of_joining)}</dd>
              <dt>Last working day</dt><dd>{e.last_working_day ? formatDate(e.last_working_day) : "—"}</dd>
            </dl>
          </div>
        )}

        {current === "statutory" && (
          <dl className="kv">
            <dt>PAN</dt>
            <dd>{hr ? <RevealButton employeeId={e.id} field="pan" masked={profile.statutory.pan} /> : <span className="masked">🔒 {profile.statutory.pan}</span>}</dd>
            <dt>Aadhaar</dt>
            <dd><span className="masked">🔒 {profile.statutory.aadhaar}</span> <span className="caption">Never shown in full</span></dd>
            <dt>UAN</dt>
            <dd><span className="masked">🔒 {profile.statutory.uan}</span></dd>
          </dl>
        )}

        {current === "bank" && (
          <dl className="kv">
            <dt>Account number</dt>
            <dd>{hr ? <RevealButton employeeId={e.id} field="account_number" masked={profile.bank.account_number} /> : <span className="masked">🔒 {profile.bank.account_number}</span>}</dd>
            <dt>IFSC</dt><dd className="mono">{profile.bank.ifsc}</dd>
            <dt>Bank</dt><dd>{profile.bank.bank_name}</dd>
          </dl>
        )}

        {current === "emergency" && (isSelf || hr) && <ContactForm employeeId={e.id} initial={contact} section="emergency" />}
      </div>

      {hr && !isSelf && (
        <div className="card">
          <h2>Deactivate (exit)</h2>
          <DeactivatePanel employeeId={e.id} lastWorkingDay={e.last_working_day} today={session.today} />
        </div>
      )}

      {hr && (
        <div className="card">
          <h2>Audit trail</h2>
          {audit.length === 0 ? (
            <p className="muted">No changes recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Field</th><th>Old value</th><th>New value</th><th>Reason</th></tr></thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td>{formatISTDateTime(a.changed_at)}</td>
                      <td>{a.changed_by_name ?? "System"}</td>
                      <td>{a.action}</td>
                      <td className="mono">{a.field}</td>
                      <td>{a.old_value ?? "—"}</td>
                      <td>{a.new_value ?? "—"}</td>
                      <td>{a.reason ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
