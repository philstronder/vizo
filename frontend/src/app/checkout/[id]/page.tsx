import { CheckoutView } from "@/components/checkout/CheckoutView";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <CheckoutView listingId={id} />
    </RequireAuth>
  );
}
