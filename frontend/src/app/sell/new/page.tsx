import { CreateListingFlow } from "@/components/sell/CreateListingFlow";
import { RequireAuth } from "@/components/auth/RequireAuth";

// ?store=<id> lists the item as a product of that TV show store (admins only).
export default async function NewListingPage({ searchParams }: PageProps<"/sell/new">) {
  const { store } = await searchParams;
  return (
    <RequireAuth>
      <CreateListingFlow storeId={typeof store === "string" ? store : undefined} />
    </RequireAuth>
  );
}
