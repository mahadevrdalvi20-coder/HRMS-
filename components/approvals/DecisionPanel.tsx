"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideLeave, certificateLink } from "@/lib/leave/actions";
import { decideRegularisation } from "@/lib/attendance/actions";

export function DecisionPanel({ kind, id, hasCertificate }: { kind: "leave" | "regularisation"; id: string; hasCertificate?: boolean }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const decide = (approve: boolean) =>
    start(async () => {
      const r = kind === "leave" ? await decideLeave(id, approve, comment) : await decideRegularisation(id, approve, comment);
      setMsg(r.ok ? { ok: true, text: r.message ?? "Done" } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  return (
    <div className="stack">
      {hasCertificate && (
        <div>
          <button className="btn ghost small" onClick={() => start(async () => { const r = await certificateLink(id); if (r.ok) window.open(r.data!.url, "_blank", "noopener"); else setMsg({ ok: false, text: r.error }); })}>
            View medical certificate
          </button>
        </div>
      )}
      <div className="field">
        <label htmlFor={`c-${id}`}>Comment</label>
        <input id={`c-${id}`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Required when rejecting" />
      </div>
      <div className="row">
        <button className="btn" disabled={pending} onClick={() => decide(true)}>Approve</button>
        <button className="btn danger" disabled={pending} onClick={() => decide(false)}>Reject</button>
      </div>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`} role="alert">{msg.text}</div>}
    </div>
  );
}
