import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrdersView } from "@/components/orders/OrdersView";
import { fetchMyOrders, fetchNotifications, reviewBuyer } from "@/lib/api";
import type { Order } from "@/types";
import { makeCompletedOrder, makeOrder } from "../order-fixture";
import { renderWithProviders } from "../render";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchMyOrders: vi.fn(),
  fetchNotifications: vi.fn(),
  fetchOrderMessages: vi.fn().mockResolvedValue([]),
  reviewBuyer: vi.fn(),
}));

// Signed in as the seller of the fixture orders.
let userId = "s";
vi.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: { id: userId, name: "Bruno" } }) }));

// The URL's query string, changed by tests to follow a notification link.
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/orders",
  useSearchParams: () => searchParams,
}));

async function renderOrders(orders: Order[]) {
  vi.mocked(fetchMyOrders).mockResolvedValue(orders);
  const view = renderWithProviders(<OrdersView />);
  await screen.findByRole("heading", { name: "Sales" });
  return { ...view, user: userEvent.setup() };
}

// The order row showing this listing.
const row = (title: string) => screen.getByText(title).closest("div.py-3") as HTMLElement;
const ratingDialog = () => screen.queryByRole("heading", { name: "Rate Ana" });

describe("OrdersView buyer reviews", () => {
  beforeEach(() => {
    userId = "s";
    searchParams = new URLSearchParams();
    vi.mocked(fetchNotifications).mockResolvedValue([]);
    vi.mocked(reviewBuyer).mockReset();
  });

  it("shows the seller the buyer's reputation before the handoff", async () => {
    await renderOrders([
      makeOrder({ id: "o1", listingTitle: "Bike", buyerRating: 4.5, buyerReviewCount: 2 }),
      makeOrder({ id: "o2", listingTitle: "Lamp", buyerName: "Carla" }),
    ]);

    const bike = within(row("Bike"));
    expect(bike.getByText("4.5")).toBeInTheDocument();
    expect(bike.getByText("(2 ratings)")).toBeInTheDocument();
    expect(within(row("Lamp")).getByText("No ratings yet")).toBeInTheDocument();
  });

  it("doesn't show buyers their own reputation on purchases", async () => {
    userId = "b";
    await renderOrders([makeOrder({ buyerRating: 4.5, buyerReviewCount: 2 })]);

    expect(screen.queryByText("(2 ratings)")).not.toBeInTheDocument();
    expect(screen.queryByText("No ratings yet")).not.toBeInTheDocument();
  });

  it("only offers to rate the buyer once the order is completed", async () => {
    await renderOrders([makeOrder()]);
    expect(screen.queryByRole("button", { name: "Rate buyer" })).not.toBeInTheDocument();
  });

  it("lets the seller rate the buyer of a completed sale", async () => {
    const order = makeCompletedOrder();
    vi.mocked(reviewBuyer).mockResolvedValue({ ...order, buyerReviewRating: 5, buyerRating: 5, buyerReviewCount: 1 });
    const { user } = await renderOrders([order]);

    await user.click(within(row("Bike")).getByRole("button", { name: "Rate buyer" }));
    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    await user.click(screen.getByRole("button", { name: "Submit rating" }));

    const bike = within(row("Bike"));
    expect(await bike.findByText("You rated Ana")).toBeInTheDocument();
    expect(bike.queryByRole("button", { name: "Rate buyer" })).not.toBeInTheDocument();
    expect(bike.getByText("(1 rating)")).toBeInTheDocument();
    expect(reviewBuyer).toHaveBeenCalledWith("o1", { rating: 5, comment: undefined });
  });

  it("shows the rating already given instead of the button", async () => {
    await renderOrders([makeCompletedOrder({ buyerReviewRating: 3 })]);
    expect(within(row("Bike")).getByText("You rated Ana")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rate buyer" })).not.toBeInTheDocument();
  });

  it("opens the rating form from a notification link", async () => {
    searchParams = new URLSearchParams("rate=o1");
    await renderOrders([makeCompletedOrder()]);
    expect(ratingDialog()).toBeInTheDocument();
  });

  it("opens the rating form when the link is followed while already on the page", async () => {
    const { rerender } = await renderOrders([makeCompletedOrder()]);
    expect(ratingDialog()).not.toBeInTheDocument();

    searchParams = new URLSearchParams("rate=o1");
    rerender(<OrdersView />);
    expect(await screen.findByRole("heading", { name: "Rate Ana" })).toBeInTheDocument();
  });

  it("doesn't open the rating form for another order", async () => {
    searchParams = new URLSearchParams("rate=o2");
    await renderOrders([makeCompletedOrder()]);
    expect(ratingDialog()).not.toBeInTheDocument();
  });
});
