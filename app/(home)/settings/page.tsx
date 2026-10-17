import { requireHr } from "@/lib/auth";
import { db, must } from "@/lib/db";
import { formatDate, yearOf } from "@/lib/dates";
import type { Department, Holiday, LeaveType, Location } from "@/lib/types";
import { PageHead } from "@/components/ui";
import {
  AddDepartmentForm, AddHolidayForm, AddLocationForm, DeleteHolidayButton, LeaveTypeEditor, PolicyEditor, WeeklyOffEditor,
} from "@/components/settings/SettingsForms";

export default async function Settings({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const s = await requireHr();
  const sp = await searchParams;
  const year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : yearOf(s.today);
  const sb = db();
  const [locs, depts, hols, types, policies] = await Promise.all([
    sb.from("locations").select("*").order("name"),
    sb.from("departments").select("*").order("name"),
    sb.from("holidays").select("*").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`).order("date"),
    sb.from("leave_types").select("*").order("sort_order"),
    sb.from("policy_documents").select("*").order("key"),
  ]);
  const locations = must(locs, "locations") as Location[];
  const departments = must(depts, "departments") as Department[];
  const holidays = must(hols, "holidays") as Holiday[];
  const leaveTypes = must(types, "leave types") as LeaveType[];
  const policyDocs = must(policies, "policies") as { key: string; title: string; body: string }[];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="stack">
      <PageHead title="Settings" sub="Locations, weekly offs, holidays, departments, leave types and the policy text Ask HR uses" />

      <div className="card">
        <h2>Locations and weekly offs</h2>
        <div className="stack">
          {locations.map((l) => (
            <div key={l.id} className="stack" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <div><strong>{l.name}</strong> <span className="muted">· {l.city}, {l.state} · off: {l.weekly_off_days.map((d) => DAYS[d]).join(" + ")}</span></div>
              <WeeklyOffEditor locationId={l.id} initial={l.weekly_off_days} />
            </div>
          ))}
          <AddLocationForm />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Holidays {year}</h2>
          <form className="row" method="get">
            <label htmlFor="year" className="caption">Year</label>
            <input id="year" name="year" type="number" defaultValue={year} style={{ width: 100 }} />
            <button className="btn small secondary">Show</button>
          </form>
        </div>
        <div className="grid grid-2">
          {locations.map((l) => (
            <div key={l.id}>
              <h3>{l.name}</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Date</th><th>Holiday</th><th>Type</th><th /></tr></thead>
                  <tbody>
                    {holidays.filter((h) => h.location_id === l.id).map((h) => (
                      <tr key={h.id}>
                        <td>{formatDate(h.date)}</td>
                        <td>{h.name}</td>
                        <td><span className={`badge ${h.type === "Optional" ? "st-WO" : "st-H"}`}>{h.type}</span></td>
                        <td><DeleteHolidayButton id={h.id} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        <h3 className="mt-lg">Add a holiday</h3>
        <AddHolidayForm locations={locations.map((l) => ({ id: l.id, name: l.name }))} year={year} />
      </div>

      <div className="card">
        <h2>Departments</h2>
        <p>{departments.map((d) => d.name).join(" · ")}</p>
        <AddDepartmentForm />
      </div>

      <div className="card">
        <h2>Leave types</h2>
        <div className="stack">
          {leaveTypes.map((t) => (
            <div key={t.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
              <LeaveTypeEditor initial={{
                id: t.id, code: t.code, name: t.name, annual_quota: t.annual_quota === null ? "" : String(t.annual_quota),
                accrual_method: t.accrual_method, carry_forward_max: String(t.carry_forward_max), half_day_allowed: t.half_day_allowed,
                requires_certificate_after_days: t.requires_certificate_after_days === null ? "" : String(t.requires_certificate_after_days),
                count_calendar_days: t.count_calendar_days, gender_restriction: t.gender_restriction ?? "", is_active: t.is_active,
              }} />
            </div>
          ))}
          <h3>Add a leave type</h3>
          <LeaveTypeEditor />
        </div>
      </div>

      <div className="card">
        <h2>Policy text for Ask HR</h2>
        <p className="muted">The agent answers policy questions only from this text. If something isn&apos;t written here, it says it doesn&apos;t know.</p>
        <div className="stack">
          {(policyDocs.length ? policyDocs : [{ key: "leave", title: "Leave policy", body: "" }, { key: "attendance", title: "Attendance policy", body: "" }]).map((p) => (
            <PolicyEditor key={p.key} policyKey={p.key} title={p.title} body={p.body} />
          ))}
        </div>
      </div>
    </div>
  );
}
