"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyLeave, previewLeave } from "@/lib/leave/actions";
import type { LeavePreview } from "@/lib/leave/evaluate";
import { dayName, formatDate } from "@/lib/dates";

type TypeOpt = { id: string; code: string; name: string; half_day_allowed: boolean; available: number | null; eligible: boolean; certAfter: number | null };

export function ApplyLeaveForm({ types, today, initial }: { types: TypeOpt[]; today: string; initial?: { code?: string; from?: string; to?: string; half?: boolean; reason?: string } }) {
  const router = useRouter();
  const start0 = types.find((t) => t.code === initial?.code && t.eligible) ?? types.find((t) => t.eligible);
  const [typeId, setTypeId] = useState(start0?.id ?? "");
  const [from, setFrom] = useState(initial?.from ?? today);
  const [to, setTo] = useState(initial?.to ?? initial?.from ?? today);
  const [half, setHalf] = useState(!!initial?.half);
  const [reason, setReason] = useState(initial?.reason ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<LeavePreview | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const type = useMemo(() => types.find((t) => t.id === typeId), [types, typeId]);

  useEffect(() => {
    if (!typeId || !from) return;
    const h = setTimeout(async () => {
      try {
        setPreview(await previewLeave({ leaveTypeId: typeId, from, to: half ? from : to, isHalfDay: half, reason: reason || "preview" }, !!file));
      } catch {
        setPreview(null);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [typeId, from, to, half, file, reason]);

  const submit = (convertToLop: boolean) =>
    start(async () => {
      const fd = new FormData();
      fd.set("leaveTypeId", typeId);
      fd.set("from", from);
      fd.set("to", half ? from : to);
      fd.set("isHalfDay", String(half));
      fd.set("reason", reason);
      fd.set("convertToLop", String(convertToLop));
      if (file) fd.set("certificate", file);
      const r = await applyLeave(fd);
      setResult(r.ok ? { ok: true, text: r.message ?? "Submitted" } : { ok: false, text: r.error });
      if (r.ok) {
        router.push("/leave?submitted=1");
        router.refresh();
      }
    });

  const problems = (preview?.check.errors ?? []).filter((e) => e !== "Enter a reason");
  const needsCert = preview?.check.needsCertificate || (type?.certAfter !== null && type?.certAfter !== undefined && (preview?.count.days ?? 0) > type.certAfter);

  return (
    <div className="stack">
      <div className="card">
        <h2>1. Leave type</h2>
        <div className="row" role="radiogroup" aria-label="Leave type">
          {types.filter((t) => t.eligible).map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={t.id === typeId} className={`btn small ${t.id === typeId ? "" : "secondary"}`} onClick={() => { setTypeId(t.id); if (!t.half_day_allowed) setHalf(false); }}>
              {t.code} · {t.available === null ? "∞" : t.available}
            </button>
          ))}
        </div>
        {type && <p className="caption mt">{type.name}{type.half_day_allowed ? " · half day allowed" : " · full days only"}</p>}
      </div>

      <div className="card">
        <h2>2. Dates</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="lv-from">From</label><input id="lv-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} /></div>
          {!half && <div className="field"><label htmlFor="lv-to">To</label><input id="lv-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>}
        </div>
        {type?.half_day_allowed && (
          <label className="check"><input type="checkbox" checked={half} onChange={(e) => setHalf(e.target.checked)} /> Half day (single date)</label>
        )}
        {preview && preview.count.countedDates.length + preview.count.skipped.length > 0 && (
          <div className="mt">
            <div className="row" style={{ gap: 6 }}>
              {[...preview.count.countedDates.map((d) => ({ d, ok: true, why: "" })), ...preview.count.skipped.map((s) => ({ d: s.date, ok: false, why: s.reason }))]
                .sort((a, b) => a.d.localeCompare(b.d))
                .slice(0, 40)
                .map((x) => (
                  <span key={x.d} className={`badge ${x.ok ? "st-L" : x.why.startsWith("Holiday") ? "st-H" : "st-WO"}`} title={x.why || "Counted"}>
                    {dayName(x.d)} {Number(x.d.slice(8))} {x.ok ? "✓" : x.why.startsWith("Holiday") ? "holiday" : "off"}
                  </span>
                ))}
            </div>
            <p className="mt"><strong>= {preview.count.days} working day{preview.count.days === 1 ? "" : "s"}</strong> <span className="caption">(weekly offs and holidays are not counted)</span></p>
          </div>
        )}
      </div>

      <div className="card">
        <h2>3. Reason</h2>
        <div className="field"><label htmlFor="lv-reason">Reason</label><textarea id="lv-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {needsCert && (
          <div className="field mt">
            <label htmlFor="lv-cert">Medical certificate (required for {type?.code} over {type?.certAfter} days)</label>
            <input id="lv-cert" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        )}
      </div>

      {preview && preview.type && (
        <div className="card">
          <h2>Summary</h2>
          <dl className="kv">
            <dt>Days</dt><dd>{preview.count.days}</dd>
            <dt>Balance now</dt><dd>{preview.balanceBefore === null ? "Unlimited" : preview.balanceBefore}</dd>
            <dt>After approval</dt><dd>{preview.balanceAfter === null ? "—" : preview.balanceAfter}</dd>
          </dl>
          {preview.clashes.length > 0 && (
            <div className="alert warn mt">Team clash: {preview.clashes.map((c) => `${c.name} (${c.dates})`).join(", ")}</div>
          )}
          {problems.length > 0 && (
            <div className="alert error mt" role="alert"><ul style={{ margin: 0, paddingLeft: 18 }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul></div>
          )}
          {preview.check.lopOffer && problems.length === 0 && (
            <div className="alert warn mt">
              Not enough {preview.type.code}. {preview.check.lopOffer.typedDays > 0 ? `${preview.check.lopOffer.typedDays} day(s) will use ${preview.type.code} and ` : ""}
              {preview.check.lopOffer.lopDays} day(s) can be converted to Loss of Pay (LOP).
            </div>
          )}
        </div>
      )}

      {result && <div className={`alert ${result.ok ? "ok" : "error"}`} role="alert">{result.text}</div>}

      <div className="sticky-bottom row">
        {preview?.check.lopOffer && problems.length === 0 ? (
          <button className="btn big" disabled={pending || !reason.trim()} onClick={() => submit(true)} style={{ flex: 1 }}>
            {pending ? "Submitting…" : "Submit with LOP conversion"}
          </button>
        ) : (
          <button className="btn big" disabled={pending || !reason.trim() || problems.length > 0 || !preview} onClick={() => submit(false)} style={{ flex: 1 }}>
            {pending ? "Submitting…" : "Submit leave request"}
          </button>
        )}
      </div>
      <p className="caption">Dates are in IST. {formatDate(today)} is today.</p>
    </div>
  );
}
