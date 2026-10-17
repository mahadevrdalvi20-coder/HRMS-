"use client";

import { useState, useTransition } from "react";
import { Field } from "@/components/ui";
import { INDIAN_STATES, type ContactInput, type FieldErrors } from "@/lib/employees/validation";
import { updateContact } from "@/lib/employees/actions";

export function ContactForm({ employeeId, initial, section }: { employeeId: string; initial: ContactInput; section: "contact" | "emergency" }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof ContactInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  const save = () =>
    start(async () => {
      const res = await updateContact(employeeId, v);
      setErrors(res.ok ? {} : res.fieldErrors ?? {});
      setMsg(res.ok ? { ok: true, text: res.message ?? "Saved" } : { ok: false, text: res.error });
    });

  const input = (k: keyof ContactInput, label: string, help?: string) => (
    <Field label={label} htmlFor={`c-${k}`} error={errors[k]} help={help}>
      <input id={`c-${k}`} value={v[k] ?? ""} onChange={set(k)} aria-invalid={!!errors[k]} />
    </Field>
  );

  return (
    <div className="stack">
      <div className="form-grid">
        {section === "contact" ? (
          <>
            {input("mobile", "Mobile", "10 digits starting with 6–9")}
            {input("address_line", "Address")}
            {input("city", "City")}
            <Field label="State / UT" htmlFor="c-state" error={errors.state}>
              <select id="c-state" value={v.state} onChange={set("state")}>
                {INDIAN_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            {input("pin_code", "PIN code", "6 digits")}
          </>
        ) : (
          <>
            {input("emergency_name", "Contact name")}
            {input("emergency_relation", "Relation")}
            {input("emergency_mobile", "Contact mobile")}
          </>
        )}
      </div>
      {msg && <div className={`alert ${msg.ok ? "ok" : "error"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</div>}
      <div><button className="btn" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</button></div>
    </div>
  );
}
