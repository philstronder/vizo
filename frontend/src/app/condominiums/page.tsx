import { CondominiumsView } from "@/components/condominiums/CondominiumsView";
import { RequireAdmin } from "@/components/auth/RequireAuth";

export default function CondominiumsPage() {
  return (
    <RequireAdmin>
      <CondominiumsView />
    </RequireAdmin>
  );
}
