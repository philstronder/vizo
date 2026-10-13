import { OrdersView } from "@/components/orders/OrdersView";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersView />
    </RequireAuth>
  );
}
