"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDepartment, addHoliday, addLocation, deleteHoliday, saveLeaveType, savePolicy, updateWeeklyOffs, type LeaveTypeInput } from "@/lib/settings/actions";
import type { ActionResult } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function useAction() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "Saved" } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  const note = msg && <div className={`alert ${msg.ok ? "ok" : "error"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</div>;
  return { run, pending, note };
}

export function WeeklyOffEditor({ locationId, initial }: { locationId: string; initial: number[] }) {
  const [days, setDays] = useState<number[]>(initial);
  const { run, pending, note } = useAction();
  return (
    <div className="stack">
      <div className="row" role="group" aria-label="Weekly off days">
        {DAYS.map((d, i) => (
          <label key={d} className="check" style={{ minHeight: 32 }}>
            <input type="checkbox" checked={days.includes(i)} onChange={(e) => setDays(e.target.checked ? [...days, i] : days.filter((x) => x !== i))} /> {d}
          </label>
        ))}
        <button className="btn small secondary" disabled={pending} onClick={() => run(() => updateWeeklyOffs(locationId, days))}>Save</button>
      </div>
      {note}
    </div>
  );
}

export function AddLocationForm() {
  const [v, setV] = useState({ name: "", city: "", state: "Goa" });
  const { run, pending, note } = useAction();
  return (
    <div className="stack">
      <div className="row">
        <input aria-label="Location name" placeholder="Name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} style={{ maxWidth: 200 }} />
        <input aria-label="City" placeholder="City" value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} style={{ maxWidth: 160 }} />
        <input aria-label="State" placeholder="State" value={v.state} onChange={(e) => setV({ ...v, state: e.target.value })} style={{ maxWidth: 160 }} />
        <button className="btn small" disabled={pending} onClick={() => run(() => addLocation(v.name, v.city, v.state, [0]))}>Add location</button>
      </div>
      {note}
    </div>
  );
}

export function AddDepartmentForm() {
  const [name, setName] = useState("");
  const { run, pending, note } = useAction();
  return (
    <div className="stack">
      <div className="row">
        <input aria-label="Department name" placeholder="New department" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 260 }} />
        <button className="btn small" disabled={pending} onClick={() => run(() => addDepartment(name))}>Add</button>
      </div>
      {note}
    </div>
  );
}

export function AddHolidayForm({ locations, year }: { locations: { id: string; name: string }[]; year: number }) {
  const [v, setV] = useState({ date: `${year}-01-01`, name: "", type: "State", locs: [] as string[] });
  const { run, pending, note } = useAction();
  return (
    <div className="stack">
      <div className="form-grid">
        <div className="field"><label htmlFor="h-date">Date</label><input id="h-date" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></div>
        <div className="field"><label htmlFor="h-name">Name</label><input id="h-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="h-type">Type</label>
          <select id="h-type" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
            <option>National</option><option>State</option><option>Optional</option>
          </select>
        </div>
        <div className="field"><span style={{ fontWeight: 700, fontSize: 13 }}>Locations</span>
          <div className="row">
            {locations.map((l) => (
              <label key={l.id} className="check"><input type="checkbox" checked={v.locs.includes(l.id)} onChange={(e) => setV({ ...v, locs: e.target.checked ? [...v.locs, l.id] : v.locs.filter((x) => x !== l.id) })} /> {l.name}</label>
            ))}
          </div>
        </div>
      </div>
      <p className="caption">National and State holidays are days off. Optional holidays are listed, but stay working days (take CL to use one).</p>
      {note}
      <div><button className="btn" disabled={pending} onClick={() => run(() => addHoliday(v.locs, v.date, v.name, v.type))}>Add holiday</button></div>
    </div>
  );
}

export function DeleteHolidayButton({ id }: { id: string }) {
  const { run, pending } = useAction();
  return <button className="btn ghost small" disabled={pending} onClick={() => run(() => deleteHoliday(id))} aria-label="Remove holiday">Remove</button>;
}

export function LeaveTypeEditor({ initial }: { initial?: LeaveTypeInput }) {
  const [v, setV] = useState<LeaveTypeInput>(initial ?? { code: "", name: "", annual_quota: "", accrual_method: "annual_prorated", carry_forward_max: "0", half_day_allowed: false, requires_certificate_after_days: "", count_calendar_days: false, gender_restriction: "", is_active: true });
  const { run, pending, note } = useAction();
  const t = (k: keyof LeaveTypeInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  const id = v.id ?? "new";
  return (
    <div className="stack">
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ width: 80 }}><label htmlFor={`${id}-code`}>Code</label><input id={`${id}-code`} value={v.code} onChange={t("code")} /></div>
        <div className="field" style={{ flex: "1 1 160px" }}><label htmlFor={`${id}-name`}>Name</label><input id={`${id}-name`} value={v.name} onChange={t("name")} /></div>
        <div className="field" style={{ width: 110 }}><label htmlFor={`${id}-q`}>Annual quota</label><input id={`${id}-q`} type="number" step="0.5" value={v.annual_quota} onChange={t("annual_quota")} placeholder="∞" /></div>
        <div className="field" style={{ width: 170 }}><label htmlFor={`${id}-acc`}>Accrual</label>
          <select id={`${id}-acc`} value={v.accrual_method} onChange={t("accrual_method")}>
            <option value="annual_prorated">1 Jan, pro-rated</option>
            <option value="monthly">Monthly</option>
            <option value="on_request">On request</option>
            <option value="none">None (unlimited)</option>
          </select>
        </div>
        <div className="field" style={{ width: 110 }}><label htmlFor={`${id}-cf`}>Carry fwd max</label><input id={`${id}-cf`} type="number" step="0.5" value={v.carry_forward_max} onChange={t("carry_forward_max")} /></div>
        <div className="field" style={{ width: 120 }}><label htmlFor={`${id}-cert`}>Certificate if &gt; days</label><input id={`${id}-cert`} type="number" value={v.requires_certificate_after_days} onChange={t("requires_certificate_after_days")} /></div>
        <div className="field" style={{ width: 110 }}><label htmlFor={`${id}-g`}>Only for</label>
          <select id={`${id}-g`} value={v.gender_restriction} onChange={t("gender_restriction")}><option value="">Everyone</option><option>Female</option><option>Male</option></select>
        </div>
      </div>
      <div className="row">
        <label className="check"><input type="checkbox" checked={v.half_day_allowed} onChange={t("half_day_allowed")} /> Half day allowed</label>
        <label className="check"><input type="checkbox" checked={v.count_calendar_days} onChange={t("count_calendar_days")} /> Count calendar days</label>
        <label className="check"><input type="checkbox" checked={v.is_active} onChange={t("is_active")} /> Active</label>
        <button className="btn small" disabled={pending} onClick={() => run(() => saveLeaveType(v))}>{v.id ? "Save" : "Add leave type"}</button>
      </div>
      {note}
    </div>
  );
}

export function PolicyEditor({ policyKey, title, body }: { policyKey: string; title: string; body: string }) {
  const [v, setV] = useState({ title, body });
  const { run, pending, note } = useAction();
  return (
    <div className="stack">
      <input aria-label="Policy title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
      <textarea aria-label={`${title} text`} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} style={{ minHeight: 200 }} />
      {note}
      <div><button className="btn small" disabled={pending} onClick={() => run(() => savePolicy(policyKey, v.title, v.body))}>Save policy text</button></div>
    </div>
  );
}
