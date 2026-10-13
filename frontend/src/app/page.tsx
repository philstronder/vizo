import { Suspense } from "react";
import { MarketplaceFeed } from "@/components/listings/MarketplaceFeed";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <MarketplaceFeed />
    </Suspense>
  );
}
