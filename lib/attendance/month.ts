/**
 * Build one employee's month: a status per day plus summary counts.
 * Shared by My attendance, Team attendance, the month-end report and the agent.
 */
import { eachDate, monthRange, type ISODate } from "@/lib/dates";
import { computeDayStatus, lateLopDates, type DayResult, type DayStatus } from "./rules";

export type LeaveSpan = { from_date: ISODate; to_date: ISODate; is_half_day: boolean; code: string; count_calendar_days: boolean };

export type MonthDay = DayResult & {
  date: ISODate;
  holiday: { name: string; type: string } | null;
  leave: { code: string; isHalfDay: boolean } | null;
  checkIn: string | null;
  checkOut: string | null;
  isWfh: boolean;
  regularised: boolean;
  lateLop: boolean;
};

export type MonthSummary = {
  present: number; wfh: number; halfDay: number; absent: number; leave: number; holiday: number; weeklyOff: number;
  late: number; lateLopDays: number; leaveDaysByCode: Record<string, number>; notApplicable: number; missedPunches: number;
};

export function buildMonth(input: {
  year: number;
  month: number;
  today: ISODate;
  joinDate: ISODate;
  lastWorkingDay: ISODate | null;
  weeklyOffDays: number[];
  holidays: { date: ISODate; name: string; type: string }[];
  leaves: LeaveSpan[]; // approved only
  attendance: { date: ISODate; check_in: string | null; check_out: string | null; is_wfh: boolean; regularised?: boolean }[];
}): { days: MonthDay[]; summary: MonthSummary } {
  const { from, to } = monthRange(input.year, input.month);
  const holidayByDate = new Map(input.holidays.map((h) => [h.date, h]));
  const attByDate = new Map(input.attendance.map((a) => [a.date, a]));

  const leaveByDate = new Map<ISODate, { code: string; isHalfDay: boolean }>();
  for (const l of input.leaves) {
    for (const d of eachDate(l.from_date, l.to_date)) {
      if (d < from || d > to) continue;
      leaveByDate.set(d, { code: l.code, isHalfDay: l.is_half_day });
    }
  }

  const days: MonthDay[] = eachDate(from, to).map((date) => {
    const holiday = holidayByDate.get(date) ?? null;
    const att = attByDate.get(date) ?? null;
    let leave = leaveByDate.get(date) ?? null;
    // Working-day leave types do not cover weekly offs/holidays (no sandwich rule).
    if (leave) {
      const span = input.leaves.find((l) => l.from_date <= date && l.to_date >= date)!;
      if (!span.count_calendar_days) {
        const probe = computeDayStatus({ date, today: input.today, joinDate: input.joinDate, lastWorkingDay: input.lastWorkingDay, weeklyOffDays: input.weeklyOffDays, holiday });
        if (probe.status === "H" || probe.status === "WO") leave = null;
      }
    }
    const r = computeDayStatus({
      date, today: input.today, joinDate: input.joinDate, lastWorkingDay: input.lastWorkingDay,
      weeklyOffDays: input.weeklyOffDays, holiday, leave, attendance: att,
    });
    return {
      ...r, date, holiday: holiday ? { name: holiday.name, type: holiday.type } : null, leave,
      checkIn: att?.check_in ?? null, checkOut: att?.check_out ?? null, isWfh: att?.is_wfh ?? false,
      regularised: !!att?.regularised, lateLop: false,
    };
  });

  const lopDates = new Set(lateLopDates(days));
  for (const d of days) d.lateLop = lopDates.has(d.date);

  const count = (s: DayStatus) => days.filter((d) => d.status === s).length;
  const leaveDaysByCode: Record<string, number> = {};
  for (const d of days) if (d.status === "L" && d.leave) leaveDaysByCode[d.leave.code] = (leaveDaysByCode[d.leave.code] ?? 0) + (d.leave.isHalfDay ? 0.5 : 1);

  return {
    days,
    summary: {
      present: count("P"), wfh: count("WFH"), halfDay: count("HD"), absent: count("A"), leave: count("L"),
      holiday: count("H"), weeklyOff: count("WO"), notApplicable: count("NONE"),
      late: days.filter((d) => d.late && !["L", "H", "WO"].includes(d.status)).length,
      lateLopDays: lopDates.size * 0.5,
      leaveDaysByCode,
      missedPunches: days.filter((d) => d.missedPunch && d.checkIn).length,
    },
  };
}
