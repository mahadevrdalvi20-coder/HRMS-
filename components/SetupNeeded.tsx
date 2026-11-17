import { Logo } from "@/components/Logo";

/** Shown instead of the app when required environment variables are missing. */
export function SetupNeeded({ missing }: { missing: string[] }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card" style={{ maxWidth: 560 }} role="alert">
        <div className="row" style={{ marginBottom: 12 }}>
          <Logo size={40} />
          <div>
            <h1 style={{ margin: 0 }}>Lehar needs setting up</h1>
            <div className="caption">Konkan Coastal Foods HRMS</div>
          </div>
        </div>
        <p>The app is deployed, but these environment variables are not set:</p>
        <ul>
          {missing.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
        <p>
          Add them in <b>Vercel → Project → Settings → Environment Variables</b> (or in <code>.env.local</code> when
          running locally), then <b>redeploy</b>. See the README for where each key comes from.
        </p>
      </div>
    </main>
  );
}
