"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { applyLeave } from "@/lib/leave/actions";
import { sendReminderDraft } from "@/lib/agent/actions";

type LeaveDraft = {
  draft: true; leave_code: string; from: string; to: string; half_day: boolean; reason: string; days: number;
  balance_before: number | null; balance_after: number | null; problems: string[]; needs_certificate: boolean;
  lop_offer: { typedDays: number; lopDays: number } | null; skipped: { date: string; reason: string }[];
};
type EmailDraft = { draft: true; recipients: string[]; subject: string; body: string };
type ToolPart = { type: string; state?: string; output?: unknown; toolCallId?: string };

function DraftLeaveCard({ d, typeIds }: { d: LeaveDraft; typeIds: Record<string, string> }) {
  const [state, setState] = useState<"draft" | "done" | "discarded">("draft");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (state === "discarded") return <p className="caption">Draft discarded.</p>;
  const confirm = (lop: boolean) =>
    start(async () => {
      const fd = new FormData();
      fd.set("leaveTypeId", typeIds[d.leave_code] ?? "");
      fd.set("from", d.from);
      fd.set("to", d.to);
      fd.set("isHalfDay", String(d.half_day));
      fd.set("reason", d.reason);
      fd.set("convertToLop", String(lop));
      const r = await applyLeave(fd);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Submitted" } : { ok: false, text: r.error });
      if (r.ok) setState("done");
    });
  const editHref = `/leave/apply?code=${d.leave_code}&from=${d.from}&to=${d.to}&half=${d.half_day ? 1 : 0}&reason=${encodeURIComponent(d.reason)}`;
  const blocking = d.problems.filter((p) => !p.startsWith("Enter a reason"));
  return (
    <div className="draft-card stack">
      <div className="row"><span className="badge rq-draft">{state === "done" ? "Submitted" : "Draft · not submitted"}</span><strong>{d.leave_code}</strong></div>
      <div>{d.from}{d.to !== d.from ? ` → ${d.to}` : ""}{d.half_day ? " (half day)" : ""} · <strong>{d.days} working day{d.days === 1 ? "" : "s"}</strong></div>
      {d.skipped.length > 0 && <div className="caption">Not counted: {d.skipped.map((s) => `${s.date} (${s.reason})`).join(", ")}</div>}
      <div className="caption">Balance {d.balance_before ?? "unlimited"} → {d.balance_after ?? "—"} after approval · Reason: {d.reason}</div>
      {blocking.length > 0 && <div className="alert error">{blocking.join(". ")}</div>}
      {d.lop_offer && <div className="alert warn">Not enough {d.leave_code}: {d.lop_offer.lopDays} day(s) can be converted to LOP.</div>}
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`} role="alert">{msg.text}</div>}
      {state === "draft" && (
        <div className="row">
          {blocking.length === 0 && !d.needs_certificate && (
            d.lop_offer
              ? <button className="btn small" disabled={pending} onClick={() => confirm(true)}>Confirm with LOP</button>
              : <button className="btn small" disabled={pending} onClick={() => confirm(false)}>Confirm</button>
          )}
          <Link className="btn small secondary" href={editHref}>Edit</Link>
          <button className="btn small ghost" onClick={() => setState("discarded")}>Discard</button>
        </div>
      )}
    </div>
  );
}

function DraftEmailCard({ d }: { d: EmailDraft }) {
  const [state, setState] = useState<"draft" | "sent" | "discarded">("draft");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (state === "discarded") return <p className="caption">Draft discarded.</p>;
  return (
    <div className="draft-card stack">
      <span className="badge rq-draft" style={{ alignSelf: "flex-start" }}>{state === "sent" ? "Sent" : "Draft · not sent"}</span>
      <div><strong>{d.subject}</strong> · to {d.recipients.join(", ")}</div>
      <div className="caption" style={{ whiteSpace: "pre-wrap" }}>{d.body}</div>
      {msg && <div className="alert ok">{msg}</div>}
      {state === "draft" && (
        <div className="row">
          <button className="btn small" disabled={pending} onClick={() => start(async () => { const r = await sendReminderDraft(d.recipients, d.subject, d.body); setMsg(r.ok ? r.message ?? "Sent" : r.error); if (r.ok) setState("sent"); })}>Confirm and send</button>
          <button className="btn small ghost" onClick={() => setState("discarded")}>Discard</button>
        </div>
      )}
    </div>
  );
}

export function AskHrChat({ typeIds, suggestions }: { typeIds: Record<string, string>; suggestions: string[] }) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({ transport: new DefaultChatTransport({ api: "/api/agent" }) });
  const busy = status === "submitted" || status === "streaming";
  const send = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <div className="stack">
      <div className="chat" aria-live="polite" aria-busy={busy}>
        {messages.length === 0 && (
          <div className="card">
            <p>Ask about your leave balance, holidays, how many days a leave costs, or the policy. I can draft a leave request for you to confirm.</p>
            <p className="caption">Numbers always come from Lehar&apos;s own calculations. I can&apos;t approve, reject or cancel anything, and I never see Aadhaar, PAN or bank details.</p>
          </div>
        )}
        {messages.map((m) => {
          const parts = m.parts as unknown as ToolPart[];
          const tools = parts.filter((p) => p.type.startsWith("tool-"));
          return (
            <div key={m.id} className={`bubble ${m.role === "user" ? "user" : "assistant"}`}>
              {m.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
              {tools.map((p) => {
                const out = p.output as Record<string, unknown> | undefined;
                if (p.type === "tool-draft_leave_request" && p.state === "output-available" && out?.draft) {
                  return <div key={p.toolCallId} className="mt"><DraftLeaveCard d={out as unknown as LeaveDraft} typeIds={typeIds} /></div>;
                }
                if (p.type === "tool-flag_month_end_issues" && p.state === "output-available" && (out?.draft_email as EmailDraft | null)?.draft) {
                  return <div key={p.toolCallId} className="mt"><DraftEmailCard d={out!.draft_email as EmailDraft} /></div>;
                }
                return null;
              })}
              {m.role === "assistant" && tools.length > 0 && (
                <div className="row mt" style={{ gap: 6 }} aria-label="Tools used">
                  {tools.map((p) => <span key={p.toolCallId} className="chip">{p.type.slice(5)}</span>)}
                </div>
              )}
            </div>
          );
        })}
        {busy && <div className="bubble assistant caption">Checking…</div>}
        {error && <div className="alert error" role="alert">Ask HR could not answer: {error.message}</div>}
      </div>

      <div className="sticky-bottom stack">
        <div className="row" style={{ gap: 6 }}>
          {suggestions.map((s) => <button key={s} className="btn small secondary" onClick={() => send(s)} disabled={busy}>{s}</button>)}
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <label htmlFor="ask" className="visually-hidden">Message</label>
          <input id="ask" type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. kal ki chutti chahiye, kitni CL bachi hai?" style={{ flex: 1 }} />
          <button className="btn" disabled={busy || !input.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}
