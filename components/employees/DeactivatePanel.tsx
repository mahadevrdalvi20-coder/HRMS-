"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelDeactivation, deactivateEmployee } from "@/lib/employees/actions";

export function DeactivatePanel({ employeeId, lastWorkingDay, today }: { employeeId: string; lastWorkingDay: string | null; today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (lastWorkingDay) {
    return (
      <div className="stack">
        <p>Last working day: <strong>{lastWorkingDay}</strong>{lastWorkingDay < today ? " — can no longer log in." : " — can log in until then."}</p>
        <div>
          <button className="btn secondary" disabled={pending} onClick={() => start(async () => { const r = await cancelDeactivation(employeeId); setMsg(r.ok ? { ok: true, text: r.message ?? "Done" } : { ok: false, text: r.error }); router.refresh(); })}>
            Cancel deactivation
          </button>
        </div>
        {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`}>{msg.text}</div>}
      </div>
    );
  }
  return (
    <div className="stack">
      <p className="muted">The record is never deleted. The employee can log in until the last working day.</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="lwd">Last working day</label>
          <input id="lwd" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="lwd-reason">Reason</label>
          <input id="lwd-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Resignation, retirement…" />
        </div>
      </div>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`} role="alert">{msg.text}</div>}
      <div>
        <button
          className="btn danger"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await deactivateEmployee(employeeId, date, reason);
              setMsg(r.ok ? { ok: true, text: r.message ?? "Done" } : { ok: false, text: r.error });
              if (r.ok) router.refresh();
            })
          }
        >
          Deactivate
        </button>
      </div>
    </div>
  );
}
