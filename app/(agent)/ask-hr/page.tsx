import { requireSession } from "@/lib/auth";
import { leaveTypes } from "@/lib/leave/queries";
import { AskHrChat } from "@/components/agent/AskHrChat";
import { PageHead } from "@/components/ui";

export default async function AskHr() {
  const s = await requireSession();
  const types = await leaveTypes();
  const suggestions = [
    "How many CL do I have?",
    "kal ki chutti chahiye, kitni CL bachi hai?",
    "How many days if I take Friday to Monday?",
    "Holidays this month?",
    ...(s.isManager || s.isHr ? ["Who in my team is on leave today?", "Summarise my pending approvals"] : []),
    ...(s.isHr ? ["Month-end check for last month"] : []),
  ];
  return (
    <div style={{ maxWidth: 820 }}>
      <PageHead title="Ask HR" sub="Answers come from Lehar's tools. Every tool call is logged." />
      <AskHrChat typeIds={Object.fromEntries(types.map((t) => [t.code, t.id]))} suggestions={suggestions} />
    </div>
  );
}
