"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui";
import {
  INDIAN_STATES, STEP_FIELDS, validateEmployee, type EmployeeInput, type FieldErrors,
} from "@/lib/employees/validation";
import { createEmployee, updateEmployee } from "@/lib/employees/actions";

type Option = { id: string; name: string };
const STEPS = ["Personal", "Job", "Statutory & bank", "Emergency contact", "Review"] as const;
const STEP_KEYS = ["personal", "job", "statutory", "emergency"] as const;


export function EmployeeForm({
  mode, employeeId, initial, departments, locations, managers, masked,
}: {
  mode: "create" | "edit";
  employeeId?: string;
  initial: EmployeeInput;
  departments: Option[];
  locations: Option[];
  managers: { id: string; label: string }[];
  masked?: { pan: string; aadhaar: string; uan: string; account_number: string; ifsc: string };
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [v, setV] = useState<EmployeeInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (k: keyof EmployeeInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((p) => ({ ...p, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const stepErrors = (i: number): FieldErrors => {
    const all = validateEmployee(v, mode);
    if (i >= STEP_KEYS.length) return all;
    const keys = STEP_FIELDS[STEP_KEYS[i]];
    return Object.fromEntries(Object.entries(all).filter(([k]) => keys.includes(k as keyof EmployeeInput))) as FieldErrors;
  };

  const next = () => {
    const e = stepErrors(step);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(step + 1);
  };

  const submit = () =>
    start(async () => {
      setFormError(null);
      const res = mode === "create" ? await createEmployee(v) : await updateEmployee(employeeId!, v);
      if (!res.ok) {
        setFormError(res.error);
        if (res.fieldErrors) {
          setErrors(res.fieldErrors);
          const first = STEP_KEYS.findIndex((k) => STEP_FIELDS[k].some((f) => res.fieldErrors![f]));
          if (first >= 0) setStep(first);
        }
        return;
      }
      const id = mode === "create" ? (res.data as { id: string }).id : employeeId!;
      router.push(`/employees/${id}?saved=${encodeURIComponent(res.message ?? "Saved")}`);
      router.refresh();
    });

  const text = (k: keyof EmployeeInput, label: string, opts: { type?: string; help?: string; placeholder?: string; inputMode?: "numeric" | "text" | "tel" | "email" } = {}) => (
    <Field label={label} htmlFor={k} error={errors[k]} help={opts.help}>
      <input
        id={k}
        name={k}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        placeholder={opts.placeholder}
        value={String(v[k] ?? "")}
        onChange={set(k)}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `${k}-err` : undefined}
      />
    </Field>
  );

  const select = (k: keyof EmployeeInput, label: string, options: { value: string; label: string }[], help?: string) => (
    <Field label={label} htmlFor={k} error={errors[k]} help={help}>
      <select id={k} name={k} value={String(v[k] ?? "")} onChange={set(k)} aria-invalid={!!errors[k]}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );

  const keepHelp = (current?: string) => (mode === "edit" ? `Current: ${current ?? "—"}. Leave blank to keep.` : undefined);
  const labelOf = (list: Option[], id: string) => list.find((o) => o.id === id)?.name ?? "—";

  return (
    <div className="card">
      <div className="steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <span key={s} className={i === step ? "on" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}>
            {i + 1}. {s}
          </span>
        ))}
      </div>
      {formError && <div className="alert error" role="alert" style={{ marginBottom: 16 }}>{formError}</div>}

      {step === 0 && (
        <div className="form-grid">
          {text("full_name", "Full name")}
          {text("email", "Work email", { type: "email", help: "Used to sign in" })}
          {text("mobile", "Mobile", { inputMode: "tel", help: "10 digits starting with 6–9" })}
          {text("dob", "Date of birth", { type: "date", help: "Must be 18+ on the joining date" })}
          {select("gender", "Gender", ["Female", "Male", "Other"].map((g) => ({ value: g, label: g })))}
          {text("address_line", "Address")}
          {text("city", "City")}
          {select("state", "State / UT", INDIAN_STATES.map((s) => ({ value: s, label: s })))}
          {text("pin_code", "PIN code", { inputMode: "numeric", help: "6 digits" })}
        </div>
      )}

      {step === 1 && (
        <div className="form-grid">
          {mode === "create" && (
            <div className="field">
              <label>Employee code</label>
              <div className="mono" style={{ minHeight: 44, display: "flex", alignItems: "center" }}>Auto-assigned on save (KCF####) · never changes</div>
            </div>
          )}
          {text("date_of_joining", "Date of joining", { type: "date" })}
          {text("designation", "Designation")}
          {text("grade", "Grade", { placeholder: "e.g. E2" })}
          {select("department_id", "Department", departments.map((d) => ({ value: d.id, label: d.name })))}
          {select("location_id", "Location", locations.map((l) => ({ value: l.id, label: l.name })))}
          {select("reporting_manager_id", "Reporting manager", managers.filter((m) => m.id !== employeeId).map((m) => ({ value: m.id, label: m.label })), "Cannot be the employee or someone who reports to them")}
          <div className="field">
            <label htmlFor="is_hr_admin">Access</label>
            <label className="check">
              <input id="is_hr_admin" type="checkbox" checked={v.is_hr_admin} onChange={set("is_hr_admin")} /> HR Admin
            </label>
            {errors.is_hr_admin && <span className="err" role="alert">{errors.is_hr_admin}</span>}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="form-grid">
          {text("pan", "PAN", { help: keepHelp(masked?.pan) ?? "e.g. ABCDE1234F", placeholder: "ABCDE1234F" })}
          {text("aadhaar", "Aadhaar", { inputMode: "numeric", help: keepHelp(masked?.aadhaar) ?? "12 digits. Never shown in full after saving." })}
          {text("uan", "UAN (PF number)", { inputMode: "numeric", help: keepHelp(masked?.uan) ?? "12 digits. Optional for new joiners." })}
          {text("account_number", "Bank account number", { inputMode: "numeric", help: keepHelp(masked?.account_number) ?? "9–18 digits" })}
          {text("ifsc", "IFSC", { help: keepHelp(masked?.ifsc) ?? "e.g. HDFC0001234", placeholder: "HDFC0001234" })}
          {text("bank_name", "Bank name")}
        </div>
      )}

      {step === 3 && (
        <div className="form-grid">
          {text("emergency_name", "Contact name")}
          {text("emergency_relation", "Relation")}
          {text("emergency_mobile", "Contact mobile", { inputMode: "tel" })}
        </div>
      )}

      {step === 4 && (
        <div className="stack">
          <dl className="kv">
            <dt>Name</dt><dd>{v.full_name}</dd>
            <dt>Email</dt><dd>{v.email}</dd>
            <dt>Mobile</dt><dd>{v.mobile}</dd>
            <dt>Date of birth</dt><dd>{v.dob}</dd>
            <dt>Address</dt><dd>{[v.address_line, v.city, v.state, v.pin_code].filter(Boolean).join(", ")}</dd>
            <dt>Joining</dt><dd>{v.date_of_joining}</dd>
            <dt>Designation</dt><dd>{v.designation} {v.grade && `· ${v.grade}`}</dd>
            <dt>Department</dt><dd>{labelOf(departments, v.department_id)}</dd>
            <dt>Location</dt><dd>{labelOf(locations, v.location_id)}</dd>
            <dt>Manager</dt><dd>{managers.find((m) => m.id === v.reporting_manager_id)?.label ?? "None"}</dd>
            <dt>PAN</dt><dd className="mono">{v.pan ? `${v.pan.slice(0, 5).toUpperCase()}****${v.pan.slice(-1).toUpperCase()}` : masked?.pan ?? "—"}</dd>
            <dt>Aadhaar</dt><dd className="mono">{v.aadhaar ? `XXXX XXXX ${v.aadhaar.replace(/\D/g, "").slice(-4)}` : masked?.aadhaar ?? "—"}</dd>
            <dt>Bank</dt><dd className="mono">{v.account_number ? `XXXX${v.account_number.slice(-4)}` : masked?.account_number ?? "—"} · {v.ifsc || masked?.ifsc}</dd>
            <dt>Emergency</dt><dd>{v.emergency_name} ({v.emergency_relation}) · {v.emergency_mobile}</dd>
          </dl>
        </div>
      )}

      <div className="row mt-lg">
        {step > 0 && <button type="button" className="btn secondary" onClick={() => setStep(step - 1)}>Back</button>}
        <div className="spacer" />
        {step < 4 ? (
          <button type="button" className="btn" onClick={next}>Next</button>
        ) : (
          <button type="button" className="btn" onClick={submit} disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Save employee" : "Save changes"}
          </button>
        )}
      </div>
    </div>
  );
}
