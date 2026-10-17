/**
 * Working-day counting for leave (RESEARCH.md §9 rule 5).
 * Walk every date from `from` to `to`; skip the location's weekly offs and
 * National/State holidays; count what is left. No sandwich rule: an off day
 * between two leave days is never counted.
 * Maternity (count_calendar_days) counts every date because the Act grants weeks.
 */
import { eachDate, isValidISODate, type ISODate } from "@/lib/dates";
import { isOffHoliday, isWeeklyOff } from "@/lib/attendance/rules";

export type DayCount = {
  days: number;
  countedDates: ISODate[];
  skipped: { date: ISODate; reason: string }[];
};

export function countLeaveDays(input: {
  from: ISODate;
  to: ISODate;
  weeklyOffDays: number[];
  holidays: { date: ISODate; name: string; type: string }[];
  isHalfDay?: boolean;
  countCalendarDays?: boolean;
}): DayCount {
  if (!isValidISODate(input.from) || !isValidISODate(input.to) || input.to < input.from) {
    return { days: 0, countedDates: [], skipped: [] };
  }
  const holidayByDate = new Map(input.holidays.map((h) => [h.date, h]));
  const countedDates: ISODate[] = [];
  const skipped: { date: ISODate; reason: string }[] = [];
  for (const date of eachDate(input.from, input.to)) {
    if (input.countCalendarDays) {
      countedDates.push(date);
      continue;
    }
    const h = holidayByDate.get(date);
    if (isWeeklyOff(date, input.weeklyOffDays)) skipped.push({ date, reason: "Weekly off" });
    else if (isOffHoliday(h)) skipped.push({ date, reason: `Holiday: ${h!.name}` });
    else countedDates.push(date);
  }
  const days = input.isHalfDay ? (countedDates.length > 0 ? 0.5 : 0) : countedDates.length;
  return { days, countedDates, skipped };
}
