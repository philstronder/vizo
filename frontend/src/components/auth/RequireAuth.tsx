"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (loading || !user) return null;
  return <>{children}</>;
}

// Signed-in non-admins are sent back to their community feed.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const notAdmin = !!user && !user.isAdmin;

  useEffect(() => {
    if (notAdmin) router.replace("/");
  }, [notAdmin, router]);

  return <RequireAuth>{notAdmin ? null : children}</RequireAuth>;
}
