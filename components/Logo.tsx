/** Lehar logo: a saffron wave in a teal square. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#ffffff" />
      <rect x="2" y="2" width="28" height="28" rx="7" fill="#0B4F4A" />
      <path d="M5 19c3.5 0 3.5-4 7-4s3.5 4 7 4 3.5-4 7-4" fill="none" stroke="#E8833A" strokeWidth="3" strokeLinecap="round" />
      <path d="M5 24c3.5 0 3.5-3 7-3s3.5 3 7 3 3.5-3 7-3" fill="none" stroke="#E2EFEC" strokeWidth="2" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}
