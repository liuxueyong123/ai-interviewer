"use client";

import { usePathname } from "next/navigation";
import NavBar from "./NavBar";

const NO_NAV_PATHS = ["/login", "/register", "/interview"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (NO_NAV_PATHS.some((p) => pathname.startsWith(p))) return <>{children}</>;
  return <><NavBar />{children}</>;
}
