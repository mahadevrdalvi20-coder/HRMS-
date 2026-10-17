"use client";

import { useState, useTransition } from "react";
import { revealSensitive } from "@/lib/employees/actions";

/** HR-only. The server checks the role again and writes a "reveal" audit entry. */
export function RevealButton({ employeeId, field, masked }: { employeeId: string; field: "pan" | "account_number"; masked: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="masked">
      <span aria-hidden="true">🔒</span>
      <span>{value ?? masked}</span>
      {value ? (
        <button className="btn ghost small" onClick={() => setValue(null)}>Hide</button>
      ) : (
        <button
          className="btn ghost small"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await revealSensitive(employeeId, field);
              if (r.ok) setValue(r.data!.value);
              else setErr(r.error);
            })
          }
        >
          Reveal (logged)
        </button>
      )}
      {err && <span className="err" role="alert">{err}</span>}
    </span>
  );
}
