import { expect, test } from "@playwright/test";
import { createListing, createStore, field, makeAdmin, orderRow, PASSWORD, registerResident, signIn, unique } from "./helpers";

test.describe("TV show stores", () => {
  test("a viewer scanning the QR code browses the store without an account and is asked to sign in to buy", async ({
    page,
    playwright,
  }) => {
    const adminApi = await playwright.request.newContext();
    const admin = await registerResident(adminApi);
    await makeAdmin(admin);
    const store = await createStore(adminApi, unique("Morning Show"));
    const product = await createListing(adminApi, { title: unique("Show Mug"), price: 30, storeId: store.id, quantity: 5 });
    await adminApi.dispose();

    // The QR code's target locks the tab to the store.
    await page.goto(`/tv/${store.id}`);
    await expect(page).toHaveURL(`/stores/${store.id}`);
    await expect(page.getByRole("heading", { name: store.name })).toBeVisible();
    await expect(page.getByText("Sign in or create an account to buy.")).toBeVisible();

    await page.getByText(product.title).click();
    await expect(page).toHaveURL(`/listing/${product.id}`);
    await page.getByRole("button", { name: "Buy Now" }).click();

    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(`/listing/${product.id}`)}`);
    await expect(page.getByText("Sign in to buy from the TV show's store")).toBeVisible();

    // The rest of the marketplace is off limits in store mode.
    await page.goto("/orders");
    await expect(page).toHaveURL(`/stores/${store.id}`);
  });

  test("a viewer creates an account, buys the last units, and the admin delivers them", async ({ page, playwright }) => {
    const adminApi = await playwright.request.newContext();
    const admin = await registerResident(adminApi);
    await makeAdmin(admin);
    const store = await createStore(adminApi, unique("Cooking Show"));
    const product = await createListing(adminApi, { title: unique("Chef Knife"), price: 45, storeId: store.id, quantity: 1 });
    await adminApi.dispose();

    // The ZIP code lookup goes to an external service; answer it here.
    await page.route("**/api/cep/*", (route) =>
      route.fulfill({
        json: { postalCode: "01310-100", street: "Avenida Paulista", district: "Bela Vista", city: "São Paulo", state: "SP" },
      })
    );

    await page.goto(`/tv/${store.id}`);
    await page.getByText(product.title).click();
    await page.getByRole("button", { name: "Buy Now" }).click();
    await page.getByRole("link", { name: "Create an account" }).click();

    // Viewers sign up with a phone and delivery address instead of a building.
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    const name = unique("Viewer");
    await field(page, "Name").fill(name);
    await field(page, "Email").fill(`${name.replace(/\W+/g, ".").toLowerCase()}@e2e.test`);
    await field(page, "Password").fill(PASSWORD);
    await field(page, "Phone").fill("(11) 91234-5678");
    await field(page, "ZIP code").fill("01310100");
    await expect(field(page, "Street")).toHaveValue("Avenida Paulista");
    await expect(field(page, "City")).toHaveValue("São Paulo");
    await field(page, "Number").fill("1500");
    await field(page, "Complement").fill("Apt 42");
    await page.getByRole("button", { name: "Create Account" }).click();

    // Back on the product, they check out without any meetup.
    await expect(page).toHaveURL(`/listing/${product.id}`);
    await page.getByRole("button", { name: "Buy Now" }).click();
    await expect(page.getByText("Pickup Details")).toHaveCount(0);
    await page.getByPlaceholder("4242 4242 4242 4242").fill("4242 4242 4242 4242");
    await page.getByRole("button", { name: "Confirm & Pay $45" }).click();

    await expect(page).toHaveURL(`/stores/${store.id}?purchased=1`);
    await expect(page.getByText("Order placed! The seller will contact you about delivery.")).toBeVisible();
    // That was the last unit, so viewers no longer see the product.
    await expect(page.getByText("No products in this store yet.")).toBeVisible();

    // The admin sees where to deliver it and marks it delivered.
    await page.evaluate(() => sessionStorage.clear()); // leave store mode
    await signIn(page, admin);
    await page.goto("/orders");
    const sale = orderRow(page, product.title);
    await expect(sale.getByText("Avenida Paulista, 1500 - Apt 42, Bela Vista, São Paulo - SP, 01310-100")).toBeVisible();
    await expect(sale.getByText("(11) 91234-5678")).toBeVisible();
    await sale.getByRole("button", { name: "Mark as delivered" }).click();
    await expect(sale.getByText("Completed", { exact: true })).toBeVisible();

    // Restocking puts it back on sale.
    await page.goto(`/stores/${store.id}`);
    await expect(page.getByText("All units were sold. Add more to put it back on sale.")).toBeVisible();
    await page.getByLabel("Units to add").fill("3");
    await page.getByRole("button", { name: "Add and re-publish" }).click();
    await expect(page.getByText("3 units in stock")).toBeVisible();
  });
});
