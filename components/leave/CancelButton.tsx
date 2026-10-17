"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelLeave } from "@/lib/leave/actions";

export function CancelButton({ id }: { id: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button className="btn ghost small" disabled={pending} onClick={() => {
        if (!confirm("Cancel this leave request?")) return;
        start(async () => { const r = await cancelLeave(id); if (!r.ok) setErr(r.error); router.refresh(); });
      }}>Cancel</button>
      {err && <span className="err" role="alert">{err}</span>}
    </>
  );
}
