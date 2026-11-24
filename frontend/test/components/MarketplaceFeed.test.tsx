import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketplaceFeed } from "@/components/listings/MarketplaceFeed";
import { fetchListings } from "@/lib/api";
import type { Listing } from "@/types";
import { renderWithProviders } from "../render";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchListings: vi.fn(),
}));

const listing = (overrides: Partial<Listing>): Listing =>
  ({
    id: overrides.title,
    description: "",
    category: "furniture",
    condition: "used-good",
    type: "direct",
    images: [],
    status: "active",
    quantity: 1,
    sellerId: "s1",
    sellerName: "Ana",
    createdAt: "2026-11-01T00:00:00Z",
    ...overrides,
  }) as Listing;

// Spans the very different price ranges the filter has to handle.
const listings = [
  listing({ title: "Paperback", price: 8 }),
  listing({ title: "Lamp auction", type: "auction", startingPrice: 40, currentBid: 120 }),
  listing({ title: "Sofa", price: 900 }),
  listing({ title: "Apartment", category: "real-estate", price: 450000 }),
];

async function setup() {
  vi.mocked(fetchListings).mockResolvedValue(listings);
  renderWithProviders(<MarketplaceFeed />);
  await screen.findAllByText("Paperback");
}

const priceField = (name: "Minimum price" | "Maximum price") => screen.getByRole("spinbutton", { name });

function shownTitles() {
  return listings.map((l) => l.title).filter((title) => screen.queryAllByText(title).length > 0);
}

describe("MarketplaceFeed price filter", () => {
  beforeEach(() => {
    vi.mocked(fetchListings).mockReset();
  });

  it("shows every price when no range is set", async () => {
    await setup();
    expect(shownTitles()).toEqual(["Paperback", "Lamp auction", "Sofa", "Apartment"]);
  });

  it("filters by minimum only", async () => {
    await setup();
    await userEvent.type(priceField("Minimum price"), "900");
    expect(shownTitles()).toEqual(["Sofa", "Apartment"]);
  });

  it("filters by maximum only, using an auction's current bid", async () => {
    await setup();
    await userEvent.type(priceField("Maximum price"), "100");
    expect(shownTitles()).toEqual(["Paperback"]);
  });

  it("filters by both, inclusive at the edges", async () => {
    await setup();
    await userEvent.type(priceField("Minimum price"), "120");
    await userEvent.type(priceField("Maximum price"), "900");
    expect(shownTitles()).toEqual(["Lamp auction", "Sofa"]);
  });

  it("shows the empty state when nothing is in range", async () => {
    await setup();
    await userEvent.type(priceField("Minimum price"), "1000");
    await userEvent.type(priceField("Maximum price"), "2000");
    expect(shownTitles()).toEqual([]);
    expect(screen.getByText("No listings match your filters")).toBeInTheDocument();
  });

  it("shows everything again once the fields are cleared", async () => {
    await setup();
    await userEvent.type(priceField("Maximum price"), "10");
    expect(shownTitles()).toEqual(["Paperback"]);
    await userEvent.clear(priceField("Maximum price"));
    expect(shownTitles()).toHaveLength(4);
  });
});
