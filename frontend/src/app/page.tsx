import { Suspense } from "react";
import { MarketplaceFeed } from "@/components/listings/MarketplaceFeed";
import { RequireAuth } from "@/components/auth/RequireAuth";

// The community feed is scoped to the viewer's building, so it needs an account.
export default function HomePage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <MarketplaceFeed />
      </Suspense>
    </RequireAuth>
  );
}
