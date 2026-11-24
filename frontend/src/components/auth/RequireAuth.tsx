"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ViewerHome } from "@/components/account/ViewerHome";
import { ResidencyPendingHome } from "@/components/account/ResidencyPendingHome";
import { awaitingResidencyReview, reviewsResidency } from "@/lib/api";

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

// Community pages: TV store viewer accounts have no building, so they get the
// viewer home instead, and residents whose proof of residency isn't approved
// yet get its status.
export function RequireCommunity({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <RequireAuth>
      {user && !user.buildingName ? (
        <ViewerHome />
      ) : user && awaitingResidencyReview(user) ? (
        <ResidencyPendingHome />
      ) : (
        children
      )}
    </RequireAuth>
  );
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

// The proof-of-residency queue: building admins and platform admins.
export function RequireResidencyReviewer({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const notReviewer = !!user && !reviewsResidency(user);

  useEffect(() => {
    if (notReviewer) router.replace("/");
  }, [notReviewer, router]);

  return <RequireAuth>{notReviewer ? null : children}</RequireAuth>;
}
