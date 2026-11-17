/**
 * Environment variables the app cannot start without.
 * Used by the root layout and the middleware: when any is missing, the app
 * shows a "setup needed" page instead of crashing (for example on a first
 * Vercel deploy before the keys are added). Only names are ever shown, never values.
 */
export const REQUIRED_ENV = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function missingEnv(): string[] {
  // Read each name literally so Next.js can inline the NEXT_PUBLIC_ values.
  const values: Record<(typeof REQUIRED_ENV)[number], string | undefined> = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  return REQUIRED_ENV.filter((name) => !values[name]?.trim());
}
