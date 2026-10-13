import { ProfileView } from "@/components/profile/ProfileView";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileView />
    </RequireAuth>
  );
}
