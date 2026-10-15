"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";

// Store mode: a viewer who arrived through a TV show's QR code (/tv/<id>) is
// confined to that show's store for the rest of the browser tab's session.
// Landing on a store page any other way (a copied or shared link, a QR
// scanner that reopens the page in another browser) confines them too — see
// useConfineToStore. It lives in sessionStorage, so it survives reloads and
// the sign-in / sign-up round trip.

const STORAGE_KEY = "vizo.storeMode";
const listeners = new Set<() => void>();

function readStoreId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function enterStoreMode(storeId: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, storeId);
  } catch {
    // Storage blocked (e.g. some private modes): the store still opens, the
    // viewer just isn't confined to it.
  }
  listeners.forEach((l) => l());
}

// The store this tab is confined to, null outside store mode, or undefined
// until it's known (server render and hydration).
export function useStoreMode(): string | null | undefined {
  return useSyncExternalStore(subscribe, readStoreId, () => undefined);
}

// Confines everyone but admins to `storeId` once they've reached one of its
// pages, so the store's own URL works just like its QR code. Pass undefined
// until the store (or product) is known to exist.
export function useConfineToStore(storeId: string | undefined) {
  const { user, loading } = useAuth();
  const current = useStoreMode();
  const shouldConfine = !!storeId && current === null && !loading && !user?.isAdmin;

  useEffect(() => {
    if (shouldConfine) enterStoreMode(storeId!);
  }, [shouldConfine, storeId]);
}

export function storeHref(storeId: string) {
  return `/stores/${storeId}`;
}

// Only allows same-origin relative paths, so ?next= can't send a viewer to
// another site after signing in.
export function safeNext(next: string | undefined | null): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

// Paths a store-mode viewer may visit. Listing and checkout pages also check
// that the listing belongs to this store (see ListingDetailView/CheckoutView).
function allowedInStoreMode(pathname: string, storeId: string) {
  return (
    pathname === storeHref(storeId) ||
    pathname.startsWith("/tv/") ||
    pathname.startsWith("/listing/") ||
    pathname.startsWith("/checkout/") ||
    pathname === "/login" ||
    pathname === "/register"
  );
}

export function StoreModeGuard({ children }: { children: ReactNode }) {
  const storeId = useStoreMode();
  const pathname = usePathname();
  const router = useRouter();
  const blocked = !!storeId && !allowedInStoreMode(pathname, storeId);

  useEffect(() => {
    if (blocked) router.replace(storeHref(storeId));
  }, [blocked, storeId, router]);

  if (storeId === undefined || blocked) return null;
  return <>{children}</>;
}
