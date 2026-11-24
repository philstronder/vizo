"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Building2,
  LogOut,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  Wallet,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/lib/auth-context";
import { fetchNotifications, reviewsResidency } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { storeHref, useStoreMode } from "@/lib/store-mode";
import { cn } from "@/lib/cn";

export function Header() {
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const storeMode = useStoreMode();
  const unreadCount = user ? notificationCount : 0;
  // TV store viewer accounts have no building community to search or list in.
  const isViewer = !!user && !user.buildingName;
  // Building admins (and platform admins) review proofs of residency.
  const isReviewer = !!user && reviewsResidency(user);

  useEffect(() => {
    if (!user || storeMode) return;
    let active = true;
    fetchNotifications()
      .then((notifications) => {
        if (active)
          setNotificationCount(notifications.filter((n) => !n.read).length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, pathname, storeMode]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(query ? `/?q=${encodeURIComponent(query)}` : "/");
  }

  async function handleLogout() {
    setMobileOpen(false);
    await logout();
    router.push("/");
  }

  if (storeMode) return <StoreModeHeader storeId={storeMode} />;
  // Until it's known whether this tab is confined to a store (server render
  // and hydration), show no links at all so a store viewer never gets one.
  if (storeMode === undefined) return <BareHeader />;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/90 backdrop-blur supports-[backdrop-filter]:bg-cream/70">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <button
          className="rounded-md p-2 text-ink-600 hover:bg-cream-100 md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={t.header.toggleMenu}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-amber font-black text-lg">
            M
          </span>
          <span className="font-black text-lg tracking-tight text-ink hidden sm:inline">
            MyVizo
          </span>
        </Link>

        {user && (
          <span className="hidden lg:inline text-sm text-ink-400 border-l border-line pl-4">
            {user.buildingName
              ? t.header.buildingMarketplace(user.buildingName)
              : t.header.tvStoreAccount}
          </span>
        )}

        {!isViewer && (
          <form
            onSubmit={handleSearch}
            className="ml-auto flex-1 max-w-md hidden sm:block"
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                size={16}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.header.searchPlaceholder}
                className="w-full rounded-full border border-line-strong bg-paper py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-amber/60 focus:border-amber-500"
              />
            </div>
          </form>
        )}

        <div
          className={cn(
            "ml-auto flex items-center gap-1 sm:gap-2",
            !isViewer && "sm:ml-0",
          )}
        >
          <LanguageSwitcher />
          {user ? (
            <>
              {isReviewer && (
                <Button
                  href="/verifications"
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  <BadgeCheck size={16} /> {t.header.verifications}
                </Button>
              )}
              {user.isAdmin && (
                <>
                  <Button
                    href="/stores"
                    variant="ghost"
                    size="sm"
                    className="hidden sm:inline-flex"
                  >
                    <Store size={16} /> {t.header.stores}
                  </Button>
                  <Button
                    href="/condominiums"
                    variant="ghost"
                    size="sm"
                    className="hidden sm:inline-flex"
                  >
                    <Building2 size={16} /> {t.header.condominiums}
                  </Button>
                  <Button
                    href="/admins"
                    variant="ghost"
                    size="sm"
                    className="hidden sm:inline-flex"
                  >
                    <ShieldCheck size={16} /> {t.header.admins}
                  </Button>
                </>
              )}
              {!isViewer && (
                <Button
                  href="/sell/new"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  <Plus size={16} /> {t.header.newListing}
                </Button>
              )}
              <Link
                href="/orders"
                className="relative rounded-full p-2 text-ink-600 hover:bg-cream-100"
                aria-label={t.header.notifications}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href="/orders"
                className="rounded-full p-2 text-ink-600 hover:bg-cream-100"
                aria-label={t.header.orders}
              >
                <ShoppingCart size={20} />
              </Link>
              <Link
                href="/wallet"
                className="rounded-full p-2 text-ink-600 hover:bg-cream-100"
                aria-label={t.header.wallet}
              >
                <Wallet size={20} />
              </Link>
              <Link href="/profile" aria-label={t.header.profile}>
                <Avatar name={user.name} size={34} />
              </Link>
              <button
                onClick={handleLogout}
                className="hidden sm:inline text-xs font-medium text-ink-400 hover:text-ink ml-1"
              >
                {t.header.signOut}
              </button>
            </>
          ) : (
            <>
              <Button href="/login" variant="ghost" size="sm">
                {t.header.signIn}
              </Button>
              <Button href="/register" size="sm">
                {t.header.join}
              </Button>
            </>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-cream px-4 py-3 sm:hidden">
          {!isViewer && (
            <form onSubmit={handleSearch} className="mb-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                  size={16}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.header.searchPlaceholder}
                  className="w-full rounded-full border border-line-strong bg-paper py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-amber/60"
                />
              </div>
            </form>
          )}
          {user ? (
            <div className="flex flex-col gap-2">
              {!isViewer && (
                <Button href="/sell/new" size="sm" fullWidth>
                  <Plus size={16} /> {t.header.newListing}
                </Button>
              )}
              {isReviewer && (
                <Button
                  href="/verifications"
                  variant="secondary"
                  size="sm"
                  fullWidth
                >
                  <BadgeCheck size={16} /> {t.header.verifications}
                </Button>
              )}
              {user.isAdmin && (
                <>
                  <Button
                    href="/stores"
                    variant="secondary"
                    size="sm"
                    fullWidth
                  >
                    <Store size={16} /> {t.header.stores}
                  </Button>
                  <Button
                    href="/condominiums"
                    variant="secondary"
                    size="sm"
                    fullWidth
                  >
                    <Building2 size={16} /> {t.header.condominiums}
                  </Button>
                  <Button
                    href="/admins"
                    variant="secondary"
                    size="sm"
                    fullWidth
                  >
                    <ShieldCheck size={16} /> {t.header.admins}
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                fullWidth
                onClick={handleLogout}
              >
                <LogOut size={16} /> {t.header.signOut}
              </Button>
            </div>
          ) : (
            <Button href="/login" size="sm" fullWidth>
              {t.header.signIn}
            </Button>
          )}
        </div>
      )}
    </header>
  );
}

// Viewers who came in through a TV show's QR code only get a way back to the
// store and to their account: no search, community feed, or other pages.
function StoreModeHeader({ storeId }: { storeId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const home = storeHref(storeId);
  // Come back to the product being viewed; from the auth pages themselves,
  // the forms already default to the store.
  const onAuthPage = pathname === "/login" || pathname === "/register";
  const next = onAuthPage ? "" : `?next=${encodeURIComponent(pathname)}`;

  async function handleLogout() {
    await logout();
    router.push(home);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/90 backdrop-blur supports-[backdrop-filter]:bg-cream/70">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href={home} className="flex items-center gap-2 shrink-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-amber font-black text-lg">
            M
          </span>
          <span className="font-black text-lg tracking-tight text-ink hidden sm:inline">
            MyVizo
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LanguageSwitcher />
          {user ? (
            <>
              <Avatar name={user.name} size={34} />
              <button
                onClick={handleLogout}
                className="text-xs font-medium text-ink-400 hover:text-ink ml-1"
              >
                {t.header.signOut}
              </button>
            </>
          ) : (
            <>
              <Button href={`/login${next}`} variant="ghost" size="sm">
                {t.header.signIn}
              </Button>
              <Button href={`/register${next}`} size="sm">
                {t.header.join}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function BareHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/90 backdrop-blur supports-[backdrop-filter]:bg-cream/70">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-amber font-black text-lg">
          M
        </span>
        <span className="font-black text-lg tracking-tight text-ink hidden sm:inline">
          MyVizo
        </span>
      </div>
    </header>
  );
}
