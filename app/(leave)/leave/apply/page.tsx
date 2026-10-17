import { requireSession } from "@/lib/auth";
import { getBalances } from "@/lib/leave/queries";
import { yearOf } from "@/lib/dates";
import { ApplyLeaveForm } from "@/components/leave/ApplyLeaveForm";
import { PageHead } from "@/components/ui";

export default async function ApplyLeave({ searchParams }: { searchParams: Promise<{ code?: string; from?: string; to?: string; half?: string; reason?: string }> }) {
  const s = await requireSession();
  const sp = await searchParams;
  const balances = await getBalances(s.employee, yearOf(s.today), s.today);
  return (
    <div style={{ maxWidth: 760 }}>
      <PageHead title="Apply leave" sub={`${s.location.name} · working days only, no sandwich rule`} />
      <ApplyLeaveForm
        today={s.today}
        initial={{ code: sp.code, from: sp.from, to: sp.to, half: sp.half === "1", reason: sp.reason }}
        types={balances.map((b) => ({
          id: b.type.id, code: b.type.code, name: b.type.name, half_day_allowed: b.type.half_day_allowed,
          available: b.available, eligible: b.eligible, certAfter: b.type.requires_certificate_after_days,
        }))}
      />
    </div>
  );
}
