import { expect, test } from "@playwright/test";
import {
  createListing,
  field,
  registerResident,
  signIn,
  tomorrowLocal,
  unique,
} from "./helpers";

test.describe("marketplace", () => {
  test("a seller lists an item and only their neighbors see it", async ({
    page,
    playwright,
  }) => {
    const sellerApi = await playwright.request.newContext();
    const seller = await registerResident(sellerApi);
    const neighbor = await registerResident(sellerApi, {
      buildingName: seller.buildingName,
    });
    const outsider = await registerResident(sellerApi);
    await sellerApi.dispose();
    const title = unique("Oak Desk");

    await signIn(page, seller);
    await page.goto("/sell/new");
    await field(page, "Item Name").fill(title);
    await field(page, "Description").fill("Solid oak, a few scratches.");
    await field(page, "Category").selectOption("furniture");
    await page.getByRole("button", { name: "Next" }).click();

    const publish = page.getByRole("button", { name: "Publish Listing" });
    await expect(publish).toBeDisabled();
    await page.getByPlaceholder("75").fill("120");
    await publish.click();

    await expect(page).toHaveURL(/\/listing\/[\w-]+$/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("$120").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "This is your listing" }),
    ).toBeDisabled();

    // A neighbor finds it in their feed.
    await signIn(page, neighbor);
    await page.goto("/");
    await expect(page.getByText(title)).toBeVisible();

    // Someone from another condominium doesn't.
    await signIn(page, outsider);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Marketplace Feed" }),
    ).toBeVisible();
    await expect(
      page.getByText("No listings match your filters"),
    ).toBeVisible();
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test("a neighbor buys a listing and both sides see the order", async ({
    page,
    playwright,
  }) => {
    const sellerApi = await playwright.request.newContext();
    const seller = await registerResident(sellerApi);
    const listing = await createListing(sellerApi, {
      title: unique("Bookshelf"),
      price: 80,
    });
    const buyer = await registerResident(sellerApi, {
      buildingName: seller.buildingName,
    });
    await sellerApi.dispose();

    await signIn(page, buyer);
    await page.goto(`/listing/${listing.id}`);
    await page.getByRole("button", { name: "Buy Now" }).click();

    await expect(page).toHaveURL(`/checkout/${listing.id}`);
    await expect(
      page.getByRole("heading", { name: "Transaction & Checkout" }),
    ).toBeVisible();
    await field(page, "Pickup Location").selectOption("Front Desk");
    await page.locator("#meetup-at").fill(tomorrowLocal());
    await field(page, "Card Number").fill("4242 4242 4242 4242");
    await page.getByRole("button", { name: "Confirm & Pay $80" }).click();

    await expect(page).toHaveURL("/orders");
    await expect(page.getByText(listing.title, { exact: true })).toBeVisible();
    await expect(page.getByText("Payment held by MyVizo").first()).toBeVisible();

    // The listing is off the market.
    await page.goto(`/listing/${listing.id}`);
    await expect(page.getByRole("button", { name: "Sold" })).toBeDisabled();

    // The seller sees the sale.
    await signIn(page, seller);
    await page.goto("/orders");
    await expect(page.getByText(listing.title, { exact: true })).toBeVisible();
  });

  test("a neighbor bids on an auction", async ({ page, playwright }) => {
    const sellerApi = await playwright.request.newContext();
    const seller = await registerResident(sellerApi);
    const listing = await createListing(sellerApi, {
      title: unique("Vintage Lamp"),
      type: "auction",
      startingPrice: 50,
    });
    const bidder = await registerResident(sellerApi, {
      buildingName: seller.buildingName,
    });
    await sellerApi.dispose();

    await signIn(page, bidder);
    await page.goto(`/listing/${listing.id}`);
    await expect(page.getByText("You: Not bidding")).toBeVisible();
    await page.getByRole("button", { name: "Place Bid" }).click();

    await expect(
      page.getByRole("heading", { name: "Place a Bid" }),
    ).toBeVisible();
    const amount = page.getByRole("spinbutton");
    await expect(amount).toHaveValue("51"); // the minimum next bid
    await amount.fill("65");
    await page.getByRole("button", { name: "Confirm Bid" }).click();

    await expect(
      page.getByRole("heading", { name: "Place a Bid" }),
    ).toHaveCount(0);
    await expect(page.getByText("You: Highest bidder")).toBeVisible();
    await expect(
      page.getByText("1 bid", { exact: false }).first(),
    ).toBeVisible();
    await expect(page.getByText("$65").first()).toBeVisible();
  });

  test("a neighbor narrows the feed with a min and max price", async ({
    page,
    playwright,
  }) => {
    // A fresh building, so the feed holds only these listings.
    const sellerApi = await playwright.request.newContext();
    const seller = await registerResident(sellerApi);
    const [paperback, lamp, sofa, apartment] = await Promise.all([
      createListing(sellerApi, { title: unique("Paperback"), price: 8 }),
      createListing(sellerApi, {
        title: unique("Lamp"),
        type: "auction",
        startingPrice: 120,
      }),
      createListing(sellerApi, { title: unique("Sofa"), price: 900 }),
      createListing(sellerApi, { title: unique("Apartment"), price: 450000 }),
    ]);
    const neighbor = await registerResident(sellerApi, {
      buildingName: seller.buildingName,
    });
    await sellerApi.dispose();

    const all = [paperback, lamp, sofa, apartment];
    const expectShown = async (shown: typeof all) => {
      for (const l of all) {
        await expect(page.getByText(l.title, { exact: true })).toHaveCount(
          shown.includes(l) ? 1 : 0,
        );
      }
    };
    const min = page.getByRole("spinbutton", { name: "Minimum price" });
    const max = page.getByRole("spinbutton", { name: "Maximum price" });

    await signIn(page, neighbor);
    await page.goto("/");
    await expect(page.getByRole("slider")).toHaveCount(0);
    await expectShown(all);

    // Minimum only: no upper bound.
    await min.fill("120");
    await expectShown([lamp, sofa, apartment]);

    // Both, inclusive at the edges.
    await max.fill("900");
    await expectShown([lamp, sofa]);

    // Maximum only.
    await min.clear();
    await max.fill("100");
    await expectShown([paperback]);

    // Nothing in range.
    await min.fill("1000");
    await max.fill("2000");
    await expect(page.getByText("No listings match your filters")).toBeVisible();
    await expectShown([]);

    // Clearing both brings everything back.
    await min.clear();
    await max.clear();
    await expectShown(all);
  });
});
