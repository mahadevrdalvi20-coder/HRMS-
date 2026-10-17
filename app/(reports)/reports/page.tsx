import Link from "next/link";
import { requireManagerOrHr } from "@/lib/auth";
import { monthEndSummary } from "@/lib/reports/queries";
import { loadOrgData } from "@/lib/employees/queries";
import { MONTH_NAMES, monthOf, monthParam, parseMonthParam, shiftMonth, yearOf } from "@/lib/dates";
import { PageHead } from "@/components/ui";

export default async function Reports({ searchParams }: { searchParams: Promise<{ month?: string; location?: string; department?: string }> }) {
  const s = await requireManagerOrHr();
  const sp = await searchParams;
  const lastComplete = shiftMonth(yearOf(s.today), monthOf(s.today), -1);
  const { year, month } = sp.month ? parseMonthParam(sp.month, s.today) : lastComplete;
  const mp = monthParam(year, month);
  const future = mp > monthParam(yearOf(s.today), monthOf(s.today));
  const inProgress = mp === monthParam(yearOf(s.today), monthOf(s.today));
  const org = s.isHr ? await loadOrgData() : null;
  const filters = s.isHr ? { location: sp.location || undefined, department: sp.department || undefined } : {};
  const data = future ? null : await monthEndSummary(s, year, month, filters);
  const codes = (data?.leaveCodes ?? []).filter((c) => c !== "LOP");
  const unresolved = data?.rows.filter((r) => r.unresolved > 0) ?? [];
  const qs = new URLSearchParams({ month: mp, ...(filters.location ? { location: filters.location } : {}), ...(filters.department ? { department: filters.department } : {}) });

  return (
    <div className="stack">
      <PageHead title="Month-end summary" sub={s.isHr ? "All employees · for the payroll vendor" : "Your team"}>
        {!future && <a className="btn" href={`/api/reports/csv?${qs}`}>Download CSV</a>}
      </PageHead>

      <form className="card tight row" method="get" style={{ alignItems: "flex-end" }}>
        <div className="field"><label htmlFor="month">Month</label><input id="month" name="month" type="month" defaultValue={mp} /></div>
        {org && (
          <>
            <div className="field"><label htmlFor="location">Location</label>
              <select id="location" name="location" defaultValue={sp.location ?? ""}><option value="">All</option>{org.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="department">Department</label>
              <select id="department" name="department" defaultValue={sp.department ?? ""}><option value="">All</option>{org.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            </div>
          </>
        )}
        <button className="btn secondary">Show</button>
      </form>

      {future ? (
        <div className="card">
          <h2>{MONTH_NAMES[month - 1]} hasn&apos;t started</h2>
          <p className="muted">Latest complete month is {MONTH_NAMES[lastComplete.month - 1]} {lastComplete.year}. <Link href={`/reports?month=${monthParam(lastComplete.year, lastComplete.month)}`}>Show it</Link></p>
        </div>
      ) : (
        <>
          {inProgress && <div className="alert info">{MONTH_NAMES[month - 1]} is still running; days after today are not counted yet.</div>}
          {unresolved.length > 0 && (
            <div className="alert warn" role="alert">
              {unresolved.length} employee{unresolved.length > 1 ? "s have" : " has"} unresolved days (missed punch or pending correction): {unresolved.map((r) => `${r.name} (${r.unresolved})`).join(", ")}.{" "}
              <Link href="/approvals">Resolve in Approvals</Link> or download anyway.
            </div>
          )}
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Location</th>
                    <th className="num">Present</th><th className="num">WFH</th><th className="num">Half</th><th className="num">Absent</th>
                    {codes.map((c) => <th key={c} className="num">{c}</th>)}
                    <th className="num">Late</th><th className="num">LOP</th><th className="num">Hol</th><th className="num">WO</th><th>Check</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.rows.map((r) => (
                    <tr key={r.employee_code}>
                      <td className="mono">{r.employee_code}</td>
                      <td>{r.name}</td>
                      <td>{r.location}</td>
                      <td className="num">{r.days_present}</td>
                      <td className="num">{r.wfh_days}</td>
                      <td className="num">{r.half_days}</td>
                      <td className="num">{r.absent_days}</td>
                      {codes.map((c) => <td key={c} className="num">{r.leave[c] ?? 0}</td>)}
                      <td className="num">{r.late_marks}</td>
                      <td className="num">{r.lop_days}</td>
                      <td className="num">{r.holidays}</td>
                      <td className="num">{r.weekly_offs}</td>
                      <td>{r.adds_up ? <span className="badge st-P" title={`All ${r.days_in_month} days accounted for`}>✓ {r.days_in_month}</span> : <span className="badge st-A">Mismatch</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="caption mt">Present counts half days as ½. LOP = LOP leave + absent days + ½ per half day + ½ per 3 Lates. Check = every day of the month has exactly one status. No PAN, Aadhaar or bank details are included.</p>
          </div>
        </>
      )}
    </div>
  );
}
