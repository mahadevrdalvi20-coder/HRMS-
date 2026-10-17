import { STATUS_META, type DayStatus } from "@/lib/attendance/rules";

/** Same colours on every screen (DESIGN.md §4.2); the label/code is always shown, never colour alone. */
export function StatusBadge({ status, short = false }: { status: DayStatus | "LT"; short?: boolean }) {
  const m = STATUS_META[status];
  if (status === "NONE") return null;
  return <span className={`badge ${m.cls}`} title={m.label}>{short ? m.code : m.label}</span>;
}

export function StatusLegend() {
  return (
    <div className="row" style={{ gap: 6 }} aria-label="Status legend">
      {(["P", "WFH", "HD", "A", "L", "H", "WO", "LT"] as const).map((s) => (
        <span key={s} className={`badge ${STATUS_META[s].cls}`}>{STATUS_META[s].code} · {STATUS_META[s].label}</span>
      ))}
    </div>
  );
}
