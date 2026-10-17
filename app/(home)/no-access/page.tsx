import Link from "next/link";

export default function NoAccess() {
  return (
    <div className="card" role="alert" style={{ maxWidth: 520 }}>
      <h1>You don&apos;t have access to this page</h1>
      <p className="muted">This page is for managers or HR. Your role comes from your employee record, not from the link you opened.</p>
      <Link className="btn secondary" href="/">Back to Home</Link>
    </div>
  );
}
