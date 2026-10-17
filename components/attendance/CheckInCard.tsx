"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkIn, checkOut } from "@/lib/attendance/actions";

function istClock(): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date());
}

export function CheckInCard({ checkInTime, checkOutTime, isWfh, statusLabel, disabledReason }: {
  checkInTime: string | null; checkOutTime: string | null; isWfh: boolean; statusLabel: string; disabledReason?: string;
}) {
  const router = useRouter();
  const [clock, setClock] = useState<string>("");
  const [wfh, setWfh] = useState(isWfh);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    setClock(istClock());
    const t = setInterval(() => setClock(istClock()), 1000);
    return () => clearInterval(t);
  }, []);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "Done" } : { ok: false, text: r.error ?? "Something went wrong" });
      router.refresh();
    });

  return (
    <div className="card stack">
      <div className="row">
        <div>
          <div className="label-saffron">Today · IST</div>
          <div className="display" aria-live="off">{clock || "--:--:--"}</div>
        </div>
        <div className="spacer" />
        <span className="badge st-NONE">{statusLabel}</span>
      </div>
      {disabledReason ? (
        <div className="alert info">{disabledReason}</div>
      ) : !checkInTime ? (
        <>
          <button className="btn big" onClick={() => run(() => checkIn(wfh))} disabled={pending} style={{ width: "100%" }}>
            {pending ? "Checking in…" : "Check in"}
          </button>
          <label className="check"><input type="checkbox" checked={wfh} onChange={(e) => setWfh(e.target.checked)} /> Working from home today</label>
        </>
      ) : !checkOutTime ? (
        <>
          <p>Checked in at <strong>{checkInTime}</strong>{isWfh ? " · WFH" : ""}</p>
          <button className="btn big secondary" onClick={() => run(checkOut)} disabled={pending} style={{ width: "100%" }}>
            {pending ? "Checking out…" : "Check out"}
          </button>
        </>
      ) : (
        <p>Checked in <strong>{checkInTime}</strong> · out <strong>{checkOutTime}</strong>{isWfh ? " · WFH" : ""}</p>
      )}
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</div>}
    </div>
  );
}
