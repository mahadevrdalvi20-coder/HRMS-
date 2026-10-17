import type { ReactNode } from "react";

export function Field({ label, htmlFor, error, help, children }: { label: string; htmlFor: string; error?: string; help?: string; children: ReactNode }) {
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <span className="err" role="alert" id={`${htmlFor}-err`}>{error}</span>
      ) : help ? (
        <span className="help">{help}</span>
      ) : null}
    </div>
  );
}

const REQUEST_LABEL: Record<string, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled", draft: "Draft" };

export function RequestBadge({ status }: { status: string }) {
  return <span className={`badge rq-${status}`}>{REQUEST_LABEL[status] ?? status}</span>;
}

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <div className="muted">{sub}</div>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted" style={{ padding: "12px 0" }}>{children}</p>;
}
