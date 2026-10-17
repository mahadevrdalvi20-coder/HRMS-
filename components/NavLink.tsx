"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, exact = false }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = href === "/" || exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} className="nav" aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
