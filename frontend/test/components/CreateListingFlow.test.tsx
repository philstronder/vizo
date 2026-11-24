import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateListingFlow } from "@/components/sell/CreateListingFlow";
import { ApiError, createListing } from "@/lib/api";
import type { Listing } from "@/types";
import { renderWithProviders } from "../render";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/sell/new",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Ana", buildingName: "Aurora" } }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  createListing: vi.fn(),
}));

const control = (label: string) =>
  screen.getByText(label, { selector: "label" }).nextElementSibling as HTMLInputElement;

async function fillDetails() {
  await userEvent.type(screen.getByPlaceholderText("e.g. Vintage Oak Desk"), "Oak desk");
  await userEvent.type(screen.getByPlaceholderText(/Describe the item/), "Solid oak");
}

beforeEach(() => {
  vi.mocked(createListing).mockResolvedValue({ id: "new-listing" } as Listing);
});

describe("CreateListingFlow", () => {
  it("needs a title and description before moving on", async () => {
    renderWithProviders(<CreateListingFlow />);
    expect(screen.getByText("Sell to your neighbors at Aurora. Choose a fixed price or start an auction.")).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText("e.g. Vintage Oak Desk"), "Oak desk");
    expect(next).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText(/Describe the item/), "   ");
    expect(next).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText(/Describe the item/), "Solid oak");
    expect(next).toBeEnabled();
  });

  it("publishes a direct sale and opens it", async () => {
    renderWithProviders(<CreateListingFlow />);
    await fillDetails();
    await userEvent.selectOptions(control("Category"), "electronics");
    await userEvent.selectOptions(control("Condition"), "used-excellent");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    const publish = screen.getByRole("button", { name: "Publish Listing" });
    expect(publish).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText("75"), "120");
    await userEvent.click(publish);

    expect(createListing).toHaveBeenCalledWith({
      title: "Oak desk",
      description: "Solid oak",
      category: "electronics",
      condition: "used-excellent",
      images: [],
      type: "direct",
      price: 120,
      startingPrice: undefined,
      auctionDurationDays: undefined,
      storeId: undefined,
      quantity: undefined,
    });
    expect(push).toHaveBeenCalledWith("/listing/new-listing");
  });

  it("publishes an auction with the chosen duration", async () => {
    renderWithProviders(<CreateListingFlow />);
    await fillDetails();
    await userEvent.click(screen.getAllByRole("radio")[1]);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Auction Details")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText("10"), "40");
    await userEvent.click(screen.getByRole("button", { name: "1 week" }));
    await userEvent.click(screen.getByRole("button", { name: "Publish Auction" }));

    expect(createListing).toHaveBeenCalledWith(
      expect.objectContaining({ type: "auction", startingPrice: 40, auctionDurationDays: 7, price: undefined })
    );
  });

  it("keeps the details when going back a step", async () => {
    renderWithProviders(<CreateListingFlow />);
    await fillDetails();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByPlaceholderText("e.g. Vintage Oak Desk")).toHaveValue("Oak desk");
  });

  it("adds a stocked, new product to a TV store and returns to the store", async () => {
    renderWithProviders(<CreateListingFlow storeId="store-1" />);
    expect(screen.getByRole("heading", { name: "Add a Store Product" })).toBeInTheDocument();
    // Store products are always new, direct sales.
    expect(screen.queryByText("Condition")).not.toBeInTheDocument();
    expect(screen.queryByText("Select Listing Type")).not.toBeInTheDocument();
    await fillDetails();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByText("Contact Info")).not.toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("75"), "199");
    const units = control("Units in stock");
    await userEvent.clear(units);
    const publish = screen.getByRole("button", { name: "Publish Listing" });
    expect(publish).toBeDisabled();
    await userEvent.type(units, "25");
    await userEvent.click(publish);

    expect(createListing).toHaveBeenCalledWith(
      expect.objectContaining({ condition: "new", type: "direct", price: 199, storeId: "store-1", quantity: 25 })
    );
    expect(push).toHaveBeenCalledWith("/stores/store-1");
  });

  it("shows the server's error and lets the seller try again", async () => {
    vi.mocked(createListing).mockRejectedValueOnce(new ApiError("Add a building to your profile", 403));
    renderWithProviders(<CreateListingFlow />);
    await fillDetails();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.type(screen.getByPlaceholderText("75"), "120");
    await userEvent.click(screen.getByRole("button", { name: "Publish Listing" }));

    expect(await screen.findByText("Add a building to your profile")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Publish Listing" }));
    expect(push).toHaveBeenCalledWith("/listing/new-listing");
  });
});
