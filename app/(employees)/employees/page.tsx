import Link from "next/link";
import { requireHr } from "@/lib/auth";
import { listDirectory } from "@/lib/employees/queries";
import { PageHead, Empty } from "@/components/ui";

export default async function Directory({ searchParams }: { searchParams: Promise<{ q?: string; department?: string; location?: string; status?: string }> }) {
  const s = await requireHr();
  const f = await searchParams;
  const { rows, departments, locations } = await listDirectory(f, s.today);
  return (
    <div>
      <PageHead title="Employee directory" sub={`${rows.length} shown`}>
        <Link className="btn" href="/employees/new">Add employee</Link>
      </PageHead>
      <form className="card tight row" role="search" method="get" style={{ marginBottom: 16, alignItems: "flex-end" }}>
        <div className="field" style={{ flex: "2 1 220px" }}>
          <label htmlFor="q">Search name, code or email</label>
          <input id="q" name="q" type="search" defaultValue={f.q ?? ""} placeholder="e.g. Ravi or KCF0010" />
        </div>
        <div className="field" style={{ flex: "1 1 160px" }}>
          <label htmlFor="department">Department</label>
          <select id="department" name="department" defaultValue={f.department ?? ""}>
            <option value="">All</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 160px" }}>
          <label htmlFor="location">Location</label>
          <select id="location" name="location" defaultValue={f.location ?? ""}>
            <option value="">All</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 120px" }}>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={f.status ?? "active"}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>
        <button className="btn secondary">Filter</button>
      </form>
      <div className="card">
        {rows.length === 0 ? (
          <Empty>No employees match these filters.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Department</th><th>Location</th><th>Manager</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.employee_code}</td>
                    <td><Link href={`/employees/${r.id}`}>{r.full_name}</Link></td>
                    <td>{r.designation}</td>
                    <td>{r.department}</td>
                    <td>{r.location}</td>
                    <td>{r.manager ?? "—"}</td>
                    <td>{r.active ? <span className="badge st-P">Active</span> : <span className="badge st-A">Inactive</span>}</td>
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
