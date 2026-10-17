import { SignIn } from "@clerk/nextjs";
import { Logo } from "@/components/Logo";

export default function SignInPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="stack" style={{ alignItems: "center" }}>
        <div className="row">
          <Logo size={40} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>Lehar</div>
            <div className="caption">Konkan Coastal Foods HRMS</div>
          </div>
        </div>
        <SignIn />
      </div>
    </main>
  );
}
