import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderHandoff } from "@/components/orders/OrderHandoff";
import {
  acceptMeetup,
  ApiError,
  cancelOrder,
  completeOrder,
  proposeMeetup,
} from "@/lib/api";
import type { Order } from "@/types";
import { renderWithProviders } from "../render";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  acceptMeetup: vi.fn(),
  cancelOrder: vi.fn(),
  completeOrder: vi.fn(),
  proposeMeetup: vi.fn(),
}));

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    listingId: "l1",
    listingTitle: "Bike",
    listingImage: "l1",
    buyerId: "b",
    buyerName: "Ana",
    sellerId: "s",
    sellerName: "Bruno",
    price: 100,
    fees: 0,
    status: "pending_pickup",
    createdAt: "2026-11-01T12:00:00.000Z",
    isStoreOrder: false,
    paymentStatus: "held",
    paidWithCredits: 0,
    meetupAt: "2026-11-20T18:30:00.000Z",
    meetupProposedBy: "buyer",
    meetupConfirmed: false,
    buyerConfirmedDelivery: false,
    sellerConfirmedDelivery: false,
    ...overrides,
  };
}

function renderHandoff(order: Order, role: "buyer" | "seller") {
  const onUpdated = vi.fn();
  renderWithProviders(
    <OrderHandoff order={order} role={role} onUpdated={onUpdated} />,
  );
  return { onUpdated, user: userEvent.setup() };
}

const button = (name: string) => screen.queryByRole("button", { name });

describe("OrderHandoff", () => {
  beforeEach(() => {
    vi.mocked(acceptMeetup).mockResolvedValue(
      makeOrder({ meetupConfirmed: true }),
    );
  });

  it("shows the held payment hint for each side", () => {
    renderHandoff(makeOrder(), "buyer");
    expect(screen.getByText("Payment held by MyVizo")).toBeInTheDocument();
    expect(
      screen.getByText(/Released to the seller once you both confirm/),
    ).toBeInTheDocument();
  });

  describe("before the meetup is agreed", () => {
    it("asks the seller to accept the buyer's time, and locks the handoff", async () => {
      const { user, onUpdated } = renderHandoff(makeOrder(), "seller");

      expect(
        screen.getByText(
          "Ana suggested a pickup time. Confirm it or suggest another.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "You can confirm the handoff once the meetup time is agreed.",
        ),
      ).toBeInTheDocument();
      expect(button("I handed over the item")).not.toBeInTheDocument();

      await user.click(button("Accept time")!);
      expect(acceptMeetup).toHaveBeenCalledWith("o1");
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ meetupConfirmed: true }),
      );
    });

    it("lets the proposer wait, without an accept button", () => {
      renderHandoff(makeOrder(), "buyer");
      expect(
        screen.getByText("Waiting for Bruno to accept"),
      ).toBeInTheDocument();
      expect(button("Accept time")).not.toBeInTheDocument();
      expect(button("Suggest another time")).toBeInTheDocument();
    });

    it("lets the buyer still cancel", () => {
      renderHandoff(makeOrder(), "buyer");
      expect(button("Cancel order")).toBeInTheDocument();
    });
  });

  describe("once the meetup is agreed", () => {
    const agreed = makeOrder({ meetupConfirmed: true });

    it("unlocks the handoff confirmation for the buyer", async () => {
      vi.mocked(completeOrder).mockResolvedValue(
        makeOrder({ meetupConfirmed: true, buyerConfirmedDelivery: true }),
      );
      const { user, onUpdated } = renderHandoff(agreed, "buyer");

      expect(screen.getByText("Confirmed")).toBeInTheDocument();
      await user.click(button("I received the item")!);
      expect(completeOrder).toHaveBeenCalledWith("o1");
      expect(onUpdated).toHaveBeenCalled();
    });

    it("no longer lets the buyer cancel", () => {
      renderHandoff(agreed, "buyer");
      expect(button("Cancel order")).not.toBeInTheDocument();
    });

    it("still lets the seller cancel or confirm", () => {
      renderHandoff(agreed, "seller");
      expect(button("Cancel order")).toBeInTheDocument();
      expect(button("I handed over the item")).toBeInTheDocument();
    });
  });

  it("prompts the side that hasn't confirmed yet", () => {
    renderHandoff(
      makeOrder({ meetupConfirmed: true, sellerConfirmedDelivery: true }),
      "buyer",
    );
    expect(
      screen.getByText(/Bruno confirmed the handoff — confirm it too/),
    ).toBeInTheDocument();
    // After any confirmation nobody can cancel or reschedule.
    expect(button("Cancel order")).not.toBeInTheDocument();
    expect(button("Suggest another time")).not.toBeInTheDocument();
  });

  it("shows the side that already confirmed that it's waiting", () => {
    renderHandoff(
      makeOrder({ meetupConfirmed: true, buyerConfirmedDelivery: true }),
      "buyer",
    );
    expect(screen.getByText(/You confirmed the handoff/)).toBeInTheDocument();
    expect(
      screen.getByText(/Waiting for Bruno to confirm/),
    ).toBeInTheDocument();
    expect(button("I received the item")).not.toBeInTheDocument();
  });

  it("hides every action on a closed order", () => {
    renderHandoff(
      makeOrder({
        status: "completed",
        paymentStatus: "released",
        meetupConfirmed: true,
      }),
      "seller",
    );
    expect(screen.getByText("Payment released to seller")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("asks before cancelling, and can keep the order", async () => {
    vi.mocked(cancelOrder).mockResolvedValue(
      makeOrder({ status: "cancelled", paymentStatus: "refunded" }),
    );
    const { user, onUpdated } = renderHandoff(makeOrder(), "seller");

    await user.click(button("Cancel order")!);
    expect(screen.getByText(/Cancel this order\?/)).toBeInTheDocument();
    await user.click(button("Keep order")!);
    expect(cancelOrder).not.toHaveBeenCalled();

    await user.click(button("Cancel order")!);
    await user.click(button("Cancel order")!);
    expect(cancelOrder).toHaveBeenCalledWith("o1");
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
  });

  it("proposes a new time as an ISO timestamp", async () => {
    vi.mocked(proposeMeetup).mockResolvedValue(
      makeOrder({ meetupProposedBy: "seller" }),
    );
    const { user } = renderHandoff(makeOrder(), "seller");

    await user.click(button("Suggest another time")!);
    const input = screen.getByLabelText("New meetup time");
    await user.type(input, "2026-12-01T09:15");
    await user.click(button("Suggest time")!);

    expect(proposeMeetup).toHaveBeenCalledWith(
      "o1",
      "2026-12-01T09:15:00.000Z",
    );
    await waitFor(() =>
      expect(
        screen.queryByLabelText("New meetup time"),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows the server's error and keeps the actions available", async () => {
    vi.mocked(acceptMeetup).mockRejectedValue(
      new ApiError("The meetup is already confirmed", 409),
    );
    const { user, onUpdated } = renderHandoff(makeOrder(), "seller");

    await user.click(button("Accept time")!);

    expect(
      await screen.findByText("The meetup is already confirmed"),
    ).toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(button("Accept time")).toBeEnabled();
  });
});
