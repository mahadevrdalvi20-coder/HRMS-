import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import type { Session } from "@/lib/auth";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";

export function AppShell({ session, children }: { session: Session; children: React.ReactNode }) {
  const team = session.isHr || session.isManager;
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <Logo />
          <strong>Lehar</strong>
        </Link>
        <nav aria-label="Main">
          <NavLink href="/">Home</NavLink>
          <NavLink href="/attendance" exact>My attendance</NavLink>
          <NavLink href="/leave" exact>My leave</NavLink>
          <NavLink href="/leave/apply">Apply leave</NavLink>
          <NavLink href="/ask-hr">Ask HR</NavLink>
          <NavLink href="/profile">My profile</NavLink>
          {team && (
            <>
              <div className="nav-section">Team</div>
              <NavLink href="/approvals">Approvals</NavLink>
              <NavLink href="/attendance/team">Team attendance</NavLink>
              <NavLink href="/leave/calendar">Leave calendar</NavLink>
              <NavLink href="/reports">Reports</NavLink>
            </>
          )}
          {session.isHr && (
            <>
              <div className="nav-section">HR Admin</div>
              <NavLink href="/employees">Employees</NavLink>
              <NavLink href="/settings">Settings</NavLink>
            </>
          )}
        </nav>
        <div className="who">
          <div style={{ fontWeight: 700 }}>{session.employee.full_name}</div>
          <div className="mono" style={{ opacity: 0.8 }}>{session.employee.employee_code}</div>
          <div style={{ opacity: 0.8 }}>
            {[session.isHr && "HR Admin", session.isManager && "Manager", !session.isHr && !session.isManager && "Employee"].filter(Boolean).join(" · ")}
          </div>
          <SignOutButton>
            <button className="btn ghost small" style={{ color: "#fff", paddingLeft: 0 }}>Sign out</button>
          </SignOutButton>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
