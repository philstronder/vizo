import { CreateListingFlow } from "@/components/sell/CreateListingFlow";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function NewListingPage() {
  return (
    <RequireAuth>
      <CreateListingFlow />
    </RequireAuth>
  );
}
