import { describe, expect, it } from "vitest";
import { addMonths, istDateTimeToUtc, toISTDateString, formatISTTime, dayOfWeek, eachDate } from "@/lib/dates";

describe("IST helpers (independent of the server time zone)", () => {
  it("00:30 IST belongs to the IST date even though it is the previous UTC day", () => {
    const instant = new Date("2026-10-15T19:00:00Z"); // 00:30 IST on 16 Oct
    expect(toISTDateString(instant)).toBe("2026-10-16");
    expect(formatISTTime(instant)).toBe("00:30");
  });
  it("round-trips an IST wall-clock time", () => {
    const d = istDateTimeToUtc("2026-10-16", "10:20");
    expect(d.toISOString()).toBe("2026-10-16T04:50:00.000Z");
    expect(formatISTTime(d)).toBe("10:20");
  });
  it("day of week and ranges", () => {
    expect(dayOfWeek("2026-10-17")).toBe(6); // Saturday
    expect(eachDate("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
});
