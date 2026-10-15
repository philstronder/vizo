"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { enterStoreMode, storeHref } from "@/lib/store-mode";

export function StoreEntry({ storeId }: { storeId: string }) {
  const router = useRouter();

  useEffect(() => {
    enterStoreMode(storeId);
    router.replace(storeHref(storeId));
  }, [storeId, router]);

  return null;
}
