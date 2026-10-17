import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getProfile } from "@/lib/employees/queries";
import { ProfileView } from "@/components/employees/ProfileView";

export default async function MyProfile({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireSession();
  const { tab = "personal" } = await searchParams;
  const profile = await getProfile(s.employeeId);
  if (!profile) notFound();
  return <ProfileView session={s} profile={profile} tab={tab} basePath="/profile" />;
}
