import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RateOrderModal } from "@/components/orders/RateOrderModal";
import { ApiError, reviewBuyer, reviewOrder } from "@/lib/api";
import { makeCompletedOrder } from "../order-fixture";
import { renderWithProviders } from "../render";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  reviewBuyer: vi.fn(),
  reviewOrder: vi.fn(),
}));

const order = makeCompletedOrder();

function renderModal(target: "seller" | "buyer", locale: "en-US" | "pt-BR" = "en-US") {
  const onRated = vi.fn();
  const onClose = vi.fn();
  renderWithProviders(<RateOrderModal order={order} target={target} open onClose={onClose} onRated={onRated} />, {
    locale,
  });
  return { onRated, onClose, user: userEvent.setup() };
}

describe("RateOrderModal", () => {
  beforeEach(() => {
    vi.mocked(reviewBuyer).mockReset();
    vi.mocked(reviewOrder).mockReset();
  });

  it("lets the seller rate the buyer", async () => {
    const rated = { ...order, buyerReviewRating: 4 };
    vi.mocked(reviewBuyer).mockResolvedValue(rated);
    const { onRated, onClose, user } = renderModal("buyer");

    expect(screen.getByText("Rate Ana")).toBeInTheDocument();
    expect(screen.getByText("How did selling “Bike” go?")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(screen.getByText("Very good")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Was the buyer on time? Was the handoff easy?"), "On time");
    await user.click(screen.getByRole("button", { name: "Submit rating" }));

    await waitFor(() => expect(onRated).toHaveBeenCalledWith(rated));
    expect(onClose).toHaveBeenCalled();
    expect(reviewBuyer).toHaveBeenCalledWith("o1", { rating: 4, comment: "On time" });
    expect(reviewOrder).not.toHaveBeenCalled();
  });

  it("still lets the buyer rate the seller", async () => {
    vi.mocked(reviewOrder).mockResolvedValue({ ...order, reviewRating: 5 });
    const { onRated, user } = renderModal("seller");

    expect(screen.getByText("Rate Bruno")).toBeInTheDocument();
    expect(screen.getByText("How did buying “Bike” go?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Was the item as described? Was pickup easy?")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    await user.click(screen.getByRole("button", { name: "Submit rating" }));

    await waitFor(() => expect(onRated).toHaveBeenCalled());
    expect(reviewOrder).toHaveBeenCalledWith("o1", { rating: 5, comment: undefined });
    expect(reviewBuyer).not.toHaveBeenCalled();
  });

  it("asks for a rating before submitting", async () => {
    const { onRated, user } = renderModal("buyer");
    await user.click(screen.getByRole("button", { name: "Submit rating" }));

    expect(screen.getByText("Pick a rating from 1 to 5 stars")).toBeInTheDocument();
    expect(reviewBuyer).not.toHaveBeenCalled();
    expect(onRated).not.toHaveBeenCalled();
  });

  it("shows why the rating was refused, in the user's language", async () => {
    vi.mocked(reviewBuyer).mockRejectedValue(
      new ApiError("Only the seller can rate this buyer", 403, "only_seller_can_rate_buyer"),
    );
    const { onRated, onClose, user } = renderModal("buyer", "pt-BR");

    expect(screen.getByText("Avaliar Ana")).toBeInTheDocument();
    expect(screen.getByText("Como foi a venda de “Bike”?")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^3/ }));
    await user.click(screen.getByRole("button", { name: "Enviar avaliação" }));

    expect(await screen.findByText("Apenas o vendedor pode avaliar este comprador.")).toBeInTheDocument();
    expect(onRated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
