import type { BalanceLine } from "@/lib/leave/queries";

const RULE: Record<string, string> = {
  annual_prorated: "Credited 1 Jan · lapses 31 Dec",
  monthly: "Earned monthly · carry forward",
  on_request: "On request",
  none: "Unpaid · unlimited",
};

export function BalanceCard({ b }: { b: BalanceLine }) {
  const total = (b.accrued ?? 0) + b.opening;
  const usedPct = total ? Math.min(100, (b.used / total) * 100) : 0;
  const pendPct = total ? Math.min(100 - usedPct, (b.pending / total) * 100) : 0;
  return (
    <div className="card tight balance">
      <div className="row"><strong>{b.type.name}</strong><span className="chip">{b.type.code}</span></div>
      <div className="big">{b.available === null ? "∞" : b.available}</div>
      <div className="caption">available{b.pending ? ` · ${b.pending} pending` : ""}{b.used ? ` · ${b.used} used` : ""}</div>
      {b.available !== null && (
        <div className="bar" aria-hidden="true"><span className="used" style={{ width: `${usedPct}%` }} /><span className="pending" style={{ width: `${pendPct}%` }} /></div>
      )}
      <div className="caption">{RULE[b.type.accrual_method]}{b.type.carry_forward_max ? ` up to ${b.type.carry_forward_max}` : ""}{b.type.half_day_allowed ? " · half day OK" : ""}</div>
    </div>
  );
}
