import { notFound } from "next/navigation";
import { assertCanView, requireSession } from "@/lib/auth";
import { getProfile } from "@/lib/employees/queries";
import { ProfileView } from "@/components/employees/ProfileView";

export default async function EmployeeProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; saved?: string }> }) {
  const s = await requireSession();
  const { id } = await params;
  // URL tampering check happens before any data is loaded: only yourself or HR.
  assertCanView(s, id);
  const { tab = "personal", saved } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const profile = await getProfile(id);
  if (!profile) notFound();
  return <ProfileView session={s} profile={profile} tab={tab} basePath={`/employees/${id}`} saved={saved} />;
}
