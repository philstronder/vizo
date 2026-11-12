import { WalletView } from "@/components/wallet/WalletView";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function WalletPage() {
  return (
    <RequireAuth>
      <WalletView />
    </RequireAuth>
  );
}
