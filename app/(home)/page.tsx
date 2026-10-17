import { requireSession } from "@/lib/auth";

export default async function Home() {
  const s = await requireSession();
  return (
    <div className="card">
      <h1>Welcome, {s.employee.full_name.split(" ")[0]}</h1>
      <p className="muted">{s.location.name}</p>
    </div>
  );
}
