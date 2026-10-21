import { Suspense } from "react";
import { MarketplaceFeed } from "@/components/listings/MarketplaceFeed";
import { RequireCommunity } from "@/components/auth/RequireAuth";

// The community feed is scoped to the viewer's building, so it needs a resident account.
export default function HomePage() {
  return (
    <RequireCommunity>
      <Suspense fallback={null}>
        <MarketplaceFeed />
      </Suspense>
    </RequireCommunity>
  );
}
