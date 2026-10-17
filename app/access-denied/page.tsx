import { SignOutButton } from "@clerk/nextjs";
import { Logo } from "@/components/Logo";

export default async function AccessDenied({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const message =
    reason === "exited"
      ? "Your last working day has passed, so your Lehar account is closed. Contact HR if you think this is a mistake."
      : "Your sign-in email is not linked to an employee record. Ask HR to check the email on your profile.";
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card" style={{ maxWidth: 480 }} role="alert">
        <div className="row" style={{ marginBottom: 12 }}>
          <Logo />
          <h1>Access denied</h1>
        </div>
        <p>{message}</p>
        <SignOutButton>
          <button className="btn secondary">Sign out</button>
        </SignOutButton>
      </div>
    </main>
  );
}
