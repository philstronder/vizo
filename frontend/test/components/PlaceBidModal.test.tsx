import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaceBidModal } from "@/components/listings/PlaceBidModal";
import type { Listing } from "@/types";
import { renderWithProviders } from "../render";

const auction = (overrides: Partial<Listing> = {}) =>
  ({ id: "l1", type: "auction", startingPrice: 50, bidCount: 0, ...overrides }) as Listing;

function setup(listing = auction(), onSubmit = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  renderWithProviders(<PlaceBidModal listing={listing} open onClose={onClose} onSubmit={onSubmit} />);
  return { onSubmit, onClose, amount: screen.getByRole("spinbutton") };
}

describe("PlaceBidModal", () => {
  it("starts at the minimum next bid, above the starting price", () => {
    const { amount } = setup();
    expect(amount).toHaveValue(51);
    expect(screen.getByText("Your bid (min. $51)")).toBeInTheDocument();
  });

  it("goes from the current bid once there is one", () => {
    const { amount } = setup(auction({ currentBid: 80, bidCount: 3 }));
    expect(amount).toHaveValue(81);
    expect(screen.getByText(/3 bids/)).toBeInTheDocument();
  });

  it("refuses a bid under the minimum without calling the server", async () => {
    const { amount, onSubmit } = setup();
    await userEvent.clear(amount);
    await userEvent.type(amount, "50");
    await userEvent.click(screen.getByRole("button", { name: "Confirm Bid" }));
    // The input's min blocks the submit natively, before the component's own check.
    expect(amount).toBeInvalid();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the amount and closes", async () => {
    const { amount, onSubmit, onClose } = setup();
    await userEvent.clear(amount);
    await userEvent.type(amount, "75");
    await userEvent.click(screen.getByRole("button", { name: "Confirm Bid" }));
    expect(onSubmit).toHaveBeenCalledWith(75);
    expect(onClose).toHaveBeenCalled();
  });

  it("stays open with the server's error, e.g. when outbid meanwhile", async () => {
    const { onClose } = setup(auction(), vi.fn().mockRejectedValue(new Error("Bid must be greater than 60")));
    await userEvent.click(screen.getByRole("button", { name: "Confirm Bid" }));
    expect(await screen.findByText("Bid must be greater than 60")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm Bid" })).toBeEnabled();
  });
});
