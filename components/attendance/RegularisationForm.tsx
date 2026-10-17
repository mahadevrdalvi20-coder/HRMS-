"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestRegularisation } from "@/lib/attendance/actions";

export function RegularisationForm({ date, defaultIn, defaultOut }: { date: string; defaultIn: string; defaultOut: string }) {
  const router = useRouter();
  const [inT, setIn] = useState(defaultIn);
  const [outT, setOut] = useState(defaultOut);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="stack">
      <div className="form-grid">
        <div className="field"><label htmlFor="r-in">Correct check-in (IST)</label><input id="r-in" type="time" value={inT} onChange={(e) => setIn(e.target.value)} /></div>
        <div className="field"><label htmlFor="r-out">Correct check-out (IST)</label><input id="r-out" type="time" value={outT} onChange={(e) => setOut(e.target.value)} /></div>
      </div>
      <div className="field"><label htmlFor="r-reason">Reason</label><textarea id="r-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot to check out after the plant audit" /></div>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</div>}
      <div>
        <button className="btn" disabled={pending} onClick={() => start(async () => {
          const r = await requestRegularisation(date, inT, outT, reason);
          setMsg(r.ok ? { ok: true, text: r.message ?? "Sent" } : { ok: false, text: r.error });
          if (r.ok) router.refresh();
        })}>{pending ? "Sending…" : "Request correction"}</button>
      </div>
    </div>
  );
}
