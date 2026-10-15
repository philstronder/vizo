import { AdminsView } from "@/components/admins/AdminsView";
import { RequireAdmin } from "@/components/auth/RequireAuth";

export default function AdminsPage() {
  return (
    <RequireAdmin>
      <AdminsView />
    </RequireAdmin>
  );
}
