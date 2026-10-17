import { NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { monthEndSummary } from "@/lib/reports/queries";
import { monthParam, parseMonthParam } from "@/lib/dates";
import { toCsv } from "@/lib/reports/summary";

/** CSV download. Managers get their team only; HR gets everyone. Never includes PAN/Aadhaar/bank. */
export async function GET(req: Request) {
  const s = await getApiSession();
  if (!s) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!s.isHr && !s.isManager) return NextResponse.json({ error: "Managers and HR only" }, { status: 403 });
  const url = new URL(req.url);
  const { year, month } = parseMonthParam(url.searchParams.get("month") ?? undefined, s.today);
  const filters = s.isHr ? { location: url.searchParams.get("location") || undefined, department: url.searchParams.get("department") || undefined } : {};
  const { rows, leaveCodes } = await monthEndSummary(s, year, month, filters);
  return new NextResponse(toCsv(rows, leaveCodes), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lehar-attendance-${monthParam(year, month)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
