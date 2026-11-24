import { RequireResidencyReviewer } from "@/components/auth/RequireAuth";
import { VerificationsView } from "@/components/verifications/VerificationsView";

export default function VerificationsPage() {
  return (
    <RequireResidencyReviewer>
      <VerificationsView />
    </RequireResidencyReviewer>
  );
}
