import { StoresAdminView } from "@/components/stores/StoresAdminView";
import { RequireAdmin } from "@/components/auth/RequireAuth";

export default function StoresPage() {
  return (
    <RequireAdmin>
      <StoresAdminView />
    </RequireAdmin>
  );
}
