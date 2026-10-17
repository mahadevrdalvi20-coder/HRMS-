import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <AppShell session={session}>{children}</AppShell>;
}
