import { beforeEach, describe, expect, it, vi } from "vitest";
import { findListingById, type ListingRow } from "../../src/db/listings";
import { findUserById } from "../../src/db/users";
import { HttpError } from "../../src/lib/http-error";
import { findViewableListing } from "../../src/lib/listing-access";
import { BUYER_ID, LISTING_ID, SELLER_ID, makeUserRow } from "./fixtures";

vi.mock("../../src/db/listings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/db/listings")>()),
  findListingById: vi.fn(),
}));
vi.mock("../../src/db/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/db/users")>()),
  findUserById: vi.fn(),
}));

const listing = (overrides: Partial<ListingRow> = {}) =>
  ({ id: LISTING_ID, seller_id: SELLER_ID, store_id: null, seller_building_name: "Edifício Aurora", ...overrides }) as ListingRow;

async function status(viewerId: string | undefined) {
  try {
    await findViewableListing(LISTING_ID, viewerId);
    return 200;
  } catch (err) {
    return (err as HttpError).status;
  }
}

beforeEach(() => {
  vi.mocked(findListingById).mockResolvedValue(listing());
  vi.mocked(findUserById).mockResolvedValue(makeUserRow({ id: BUYER_ID, building_name: "Edifício Aurora" }));
});

describe("findViewableListing", () => {
  it("answers 404 for an unknown listing", async () => {
    vi.mocked(findListingById).mockResolvedValue(null);
    expect(await status(BUYER_ID)).toBe(404);
  });

  it("shows store products to everyone, signed in or not", async () => {
    vi.mocked(findListingById).mockResolvedValue(listing({ store_id: "store" }));
    expect(await status(undefined)).toBe(200);
    expect(findUserById).not.toHaveBeenCalled();
  });

  it("asks signed-out visitors to sign in for community listings", async () => {
    expect(await status(undefined)).toBe(401);
  });

  it("always shows sellers their own listing", async () => {
    expect(await status(SELLER_ID)).toBe(200);
    expect(findUserById).not.toHaveBeenCalled();
  });

  it("shows neighbors the listing, ignoring case and spaces in the building name", async () => {
    vi.mocked(findUserById).mockResolvedValue(makeUserRow({ building_name: "  edifício aurora " }));
    expect(await status(BUYER_ID)).toBe(200);
  });

  it("hides it from other buildings, store viewers and deleted accounts as a 404", async () => {
    vi.mocked(findUserById).mockResolvedValue(makeUserRow({ building_name: "Boreal" }));
    expect(await status(BUYER_ID)).toBe(404);
    vi.mocked(findUserById).mockResolvedValue(makeUserRow({ building_name: null }));
    expect(await status(BUYER_ID)).toBe(404);
    vi.mocked(findUserById).mockResolvedValue(null);
    expect(await status(BUYER_ID)).toBe(404);
  });
});
