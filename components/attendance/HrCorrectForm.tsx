"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hrCorrectAttendance } from "@/lib/attendance/actions";

export function HrCorrectForm({ employees, today }: { employees: { id: string; label: string }[]; today: string }) {
  const router = useRouter();
  const [v, setV] = useState({ employeeId: "", date: today, inT: "09:30", outT: "18:00", wfh: false, reason: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="stack">
      <div className="form-grid">
        <div className="field"><label htmlFor="hc-emp">Employee</label>
          <select id="hc-emp" value={v.employeeId} onChange={(e) => setV({ ...v, employeeId: e.target.value })}>
            <option value="">Select…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="hc-date">Date</label><input id="hc-date" type="date" max={today} value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></div>
        <div className="field"><label htmlFor="hc-in">Check-in (IST)</label><input id="hc-in" type="time" value={v.inT} onChange={(e) => setV({ ...v, inT: e.target.value })} /></div>
        <div className="field"><label htmlFor="hc-out">Check-out (IST)</label><input id="hc-out" type="time" value={v.outT} onChange={(e) => setV({ ...v, outT: e.target.value })} /></div>
      </div>
      <label className="check"><input type="checkbox" checked={v.wfh} onChange={(e) => setV({ ...v, wfh: e.target.checked })} /> Work from home</label>
      <div className="field"><label htmlFor="hc-reason">Reason (required, logged)</label><input id="hc-reason" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></div>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`} role="alert">{msg.text}</div>}
      <div><button className="btn" disabled={pending || !v.employeeId} onClick={() => start(async () => {
        const r = await hrCorrectAttendance(v.employeeId, v.date, v.inT, v.outT, v.wfh, v.reason);
        setMsg(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error });
        if (r.ok) router.refresh();
      })}>Save correction</button></div>
    </div>
  );
}
