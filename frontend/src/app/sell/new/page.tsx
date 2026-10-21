import { CreateListingFlow } from "@/components/sell/CreateListingFlow";
import { RequireAuth, RequireCommunity } from "@/components/auth/RequireAuth";

// ?store=<id> lists the item as a product of that TV show store (admins only).
export default async function NewListingPage({ searchParams }: PageProps<"/sell/new">) {
  const { store } = await searchParams;
  if (typeof store === "string") {
    return (
      <RequireAuth>
        <CreateListingFlow storeId={store} />
      </RequireAuth>
    );
  }
  // Community listings need a building, which TV store viewer accounts don't have.
  return (
    <RequireCommunity>
      <CreateListingFlow />
    </RequireCommunity>
  );
}
