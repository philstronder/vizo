"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { storeHref, useStoreMode } from "@/lib/store-mode";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const storeId = useStoreMode();
  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-col items-center text-center">
        <Link href={storeId ? storeHref(storeId) : "/"} className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-amber font-black text-xl">
          V
        </Link>
        <h1 className="text-xl font-black text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-400">{subtitle}</p>
      </div>
      {children}
      <p className="mt-5 text-center text-sm text-ink-400">{footer}</p>
    </div>
  );
}
