/**
 * Reporting structure: an employee cannot report to themselves or to anyone
 * who (directly or indirectly) reports to them.
 */
export function createsReportingLoop(
  employeeId: string | null,
  newManagerId: string | null,
  managerOf: Map<string, string | null>,
): boolean {
  if (!newManagerId || !employeeId) return false;
  let cur: string | null = newManagerId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === employeeId) return true;
    if (seen.has(cur)) return true; // existing bad data: treat as a loop
    seen.add(cur);
    cur = managerOf.get(cur) ?? null;
  }
  return false;
}
