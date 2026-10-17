/** Masking rules (CLAUDE.md rule 4). Aadhaar has no unmask function anywhere. */

export function maskPan(pan: string | null | undefined): string {
  if (!pan || pan.length !== 10) return "—";
  return `${pan.slice(0, 5)}****${pan.slice(9)}`;
}

export function maskAadhaar(aadhaar: string | null | undefined): string {
  if (!aadhaar || aadhaar.length < 4) return "—";
  return `XXXX XXXX ${aadhaar.slice(-4)}`;
}

export function maskAccount(account: string | null | undefined): string {
  if (!account || account.length < 4) return "—";
  return `XXXX${account.slice(-4)}`;
}

export function maskUan(uan: string | null | undefined): string {
  if (!uan) return "Not yet allotted";
  return `XXXXXXXX${uan.slice(-4)}`;
}
