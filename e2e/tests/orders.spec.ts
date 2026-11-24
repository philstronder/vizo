import { expect, test } from "@playwright/test";
import {
  checkout,
  createListing,
  giveCredits,
  orderRow,
  registerResident,
  signIn,
  tomorrowLocal,
  unique,
} from "./helpers";

// The full community sale after checkout: agreeing on a meetup, both sides
// confirming the handoff (each rating the other, which is mandatory), the
// held payment reaching the seller's wallet, and cancelling.

test.describe("order lifecycle", () => {
  test("meetup, handoff, payout, rating and withdrawal", async ({
    page,
    playwright,
  }) => {
    const api = await playwright.request.newContext();
    const seller = await registerResident(api, { name: unique("Seller") });
    const listing = await createListing(api, {
      title: unique("Armchair"),
      price: 80,
    });
    const buyer = await registerResident(api, {
      buildingName: seller.buildingName,
      name: unique("Buyer"),
    });
    await api.dispose();

    await signIn(page, buyer);
    await checkout(page, listing.id);

    // The seller accepts the buyer's suggested meetup and hands the item over.
    await signIn(page, seller);
    await page.goto("/orders");
    const sale = orderRow(page, listing.title);
    // A first-time buyer has no reputation yet.
    await expect(sale.getByText("No ratings yet")).toBeVisible();
    await expect(
      sale.getByText(
        `${buyer.name} suggested a pickup time. Confirm it or suggest another.`,
      ),
    ).toBeVisible();
    await expect(
      sale.getByText(
        "You can confirm the handoff once the meetup time is agreed.",
      ),
    ).toBeVisible();
    await expect(sale.getByText("Payment held by MyVizo")).toBeVisible();
    await sale.getByRole("button", { name: "Accept time" }).click();
    await expect(sale.getByText("Confirmed", { exact: true })).toBeVisible();
    // Confirming the handoff requires rating the buyer; closing the form
    // leaves the handoff unconfirmed.
    await sale.getByRole("button", { name: "I handed over the item" }).click();
    await expect(
      page.getByRole("heading", { name: `Rate ${buyer.name}` }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("heading", { name: `Rate ${buyer.name}` }),
    ).toHaveCount(0);
    await sale.getByRole("button", { name: "I handed over the item" }).click();
    await page.getByRole("button", { name: "Rate and confirm" }).click();
    await expect(
      page.getByText("Pick a rating from 1 to 5 stars"),
    ).toBeVisible();
    await page.getByRole("radio", { name: "5 stars" }).click();
    await page
      .getByPlaceholder("Was the buyer on time? Was the handoff easy?")
      .fill("Right on time");
    await page.getByRole("button", { name: "Rate and confirm" }).click();
    await expect(
      sale.getByText(
        `You confirmed the handoff · Waiting for ${buyer.name} to confirm`,
      ),
    ).toBeVisible();

    // The buyer confirms too, which completes the order and releases the payment.
    await signIn(page, buyer);
    await page.goto("/orders");
    const purchase = orderRow(page, listing.title);
    await expect(
      purchase.getByText(
        `${seller.name} confirmed the handoff — confirm it too to complete the order.`,
      ),
    ).toBeVisible();
    // Once the meetup is agreed the buyer can no longer back out.
    await expect(
      purchase.getByRole("button", { name: "Cancel order" }),
    ).toHaveCount(0);
    // The buyer has to rate the seller to confirm.
    await purchase.getByRole("button", { name: "I received the item" }).click();
    await expect(
      page.getByRole("heading", { name: `Rate ${seller.name}` }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "4 stars" }).click();
    await page
      .getByPlaceholder("Was the item as described? Was pickup easy?")
      .fill("Smooth pickup");
    await page.getByRole("button", { name: "Rate and confirm" }).click();
    await expect(
      purchase.getByText("Completed", { exact: true }),
    ).toBeVisible();
    await expect(
      purchase.getByText("Payment released to seller"),
    ).toBeVisible();
    await expect(purchase.getByText(`You rated ${seller.name}`)).toBeVisible();
    await expect(
      purchase.getByRole("button", { name: "Rate seller" }),
    ).toHaveCount(0);

    // The rating shows on the seller's listings.
    await page.goto(`/listing/${listing.id}`);
    await expect(page.getByText("(1 rating)")).toBeVisible();
    await expect(page.getByText("4.0", { exact: true })).toBeVisible();

    // The seller already rated the buyer when confirming, so there's nothing
    // left to rate, and the rating is the buyer's reputation.
    await signIn(page, seller);
    await page.goto("/orders");
    const completedSale = orderRow(page, listing.title);
    await expect(
      page.getByText(`${buyer.name} confirmed the handoff. The order is complete.`),
    ).toBeVisible();
    await expect(
      completedSale.getByText(`You rated ${buyer.name}`),
    ).toBeVisible();
    await expect(
      completedSale.getByRole("button", { name: "Rate buyer" }),
    ).toHaveCount(0);
    await expect(completedSale.getByText("(1 rating)")).toBeVisible();
    await expect(completedSale.getByText("5.0", { exact: true })).toBeVisible();

    // The seller has the sale's credits and withdraws them.
    await page.goto("/wallet");
    await expect(page.getByRole("heading", { name: "Wallet" })).toBeVisible();
    await expect(page.getByText("Sale", { exact: true })).toBeVisible();
    await expect(page.getByText(listing.title)).toBeVisible();
    await page.getByRole("button", { name: "Withdraw" }).click();
    await page.getByRole("button", { name: "Withdraw all" }).click();
    await expect(page.locator("#withdraw-amount")).toHaveValue("80");
    await page.locator("#withdraw-pix").fill("seller@pix.example");
    await page.getByRole("button", { name: "Withdraw" }).last().click();
    await expect(
      page.getByText("$80 is on its way to your account."),
    ).toBeVisible();
    await expect(page.getByText("To seller@pix.example")).toBeVisible();
    await expect(page.getByRole("button", { name: "Withdraw" })).toBeDisabled();
  });

  test("the seller suggests another meetup time and the buyer accepts it", async ({
    page,
    playwright,
  }) => {
    const api = await playwright.request.newContext();
    const seller = await registerResident(api, { name: unique("Seller") });
    const listing = await createListing(api, { title: unique("Rug") });
    const buyer = await registerResident(api, {
      buildingName: seller.buildingName,
      name: unique("Buyer"),
    });
    await api.dispose();

    await signIn(page, buyer);
    await checkout(page, listing.id);

    await signIn(page, seller);
    await page.goto("/orders");
    const sale = orderRow(page, listing.title);
    await sale.getByRole("button", { name: "Suggest another time" }).click();
    await sale.getByLabel("New meetup time").fill(tomorrowLocal());
    await sale.getByRole("button", { name: "Suggest time" }).click();
    await expect(
      sale.getByText(`Waiting for ${buyer.name} to accept`),
    ).toBeVisible();
    await expect(sale.getByRole("button", { name: "Accept time" })).toHaveCount(
      0,
    );

    await signIn(page, buyer);
    await page.goto("/orders");
    const purchase = orderRow(page, listing.title);
    await expect(
      purchase.getByText(`${seller.name} suggested this time`),
    ).toBeVisible();
    await purchase.getByRole("button", { name: "Accept time" }).click();
    await expect(
      purchase.getByText("Confirmed", { exact: true }),
    ).toBeVisible();
    await expect(
      purchase.getByRole("button", { name: "I received the item" }),
    ).toBeVisible();
  });

  test("the buyer cancels before the meetup is agreed and is refunded", async ({
    page,
    playwright,
  }) => {
    const api = await playwright.request.newContext();
    const seller = await registerResident(api);
    const listing = await createListing(api, {
      title: unique("Kettle"),
      price: 40,
    });
    const buyer = await registerResident(api, {
      buildingName: seller.buildingName,
    });
    await api.dispose();

    await signIn(page, buyer);
    await checkout(page, listing.id);
    await page.goto("/orders");
    const purchase = orderRow(page, listing.title);

    await purchase.getByRole("button", { name: "Cancel order" }).click();
    await expect(
      purchase.getByText(
        "Cancel this order? The buyer is refunded and the item goes back on sale.",
      ),
    ).toBeVisible();
    await purchase.getByRole("button", { name: "Keep order" }).click();
    await expect(purchase.getByText("Pending Pickup")).toBeVisible();

    await purchase.getByRole("button", { name: "Cancel order" }).click();
    await purchase.getByRole("button", { name: "Cancel order" }).click();
    await expect(
      purchase.getByText("Cancelled", { exact: true }),
    ).toBeVisible();
    await expect(purchase.getByText("Payment refunded")).toBeVisible();

    // The item is back on sale.
    await page.goto(`/listing/${listing.id}`);
    await expect(page.getByRole("button", { name: "Buy Now" })).toBeEnabled();
  });

  test("a buyer pays with wallet credits", async ({ page, playwright }) => {
    const api = await playwright.request.newContext();
    const seller = await registerResident(api);
    const cheap = await createListing(api, {
      title: unique("Plant"),
      price: 30,
    });
    const pricey = await createListing(api, {
      title: unique("Bicycle"),
      price: 200,
    });
    const buyer = await registerResident(api, {
      buildingName: seller.buildingName,
    });
    await api.dispose();
    await giveCredits(buyer, 50);
    await signIn(page, buyer);

    // Credits that cover the whole price need no card.
    await page.goto(`/checkout/${cheap.id}`);
    await page.getByLabel("Use my credits ($50 available)").check();
    await expect(
      page.getByText("Your credits cover the whole purchase."),
    ).toBeVisible();
    await expect(page.getByPlaceholder("4242 4242 4242 4242")).toHaveCount(0);
    await page.locator("#meetup-at").fill(tomorrowLocal());
    await page.getByRole("button", { name: "Confirm & Pay $30" }).click();
    await expect(page).toHaveURL("/orders");

    // The remaining $20 goes towards a pricier item; the card pays the rest.
    await page.goto(`/checkout/${pricey.id}`);
    await page.getByLabel("Use my credits ($20 available)").check();
    await expect(page.getByText("Paid with credits")).toBeVisible();
    await page.locator("#meetup-at").fill(tomorrowLocal());
    await page
      .getByPlaceholder("4242 4242 4242 4242")
      .fill("4242 4242 4242 4242");
    await page.getByRole("button", { name: "Confirm & Pay $180" }).click();
    await expect(page).toHaveURL("/orders");

    await page.goto("/wallet");
    await expect(page.getByText("Purchase", { exact: true })).toHaveCount(2);
  });
});
