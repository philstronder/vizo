import { expect, test, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import { field, makeAdmin, registerResident, signIn, unique } from "./helpers";

// Admin screens: TV show stores and their products, the condominium list, and
// the admin list. Lists here are shared by every test, so assertions only look
// for this test's uniquely named rows.

async function signInAsNewAdmin(page: Page, playwright: PlaywrightWorkerArgs["playwright"]) {
  const api = await playwright.request.newContext();
  const admin = await registerResident(api, { name: unique("Admin") });
  await api.dispose();
  await makeAdmin(admin);
  await signIn(page, admin);
  return admin;
}

function acceptNextDialog(page: Page, message: string) {
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toBe(message);
    void dialog.accept();
  });
}

test.describe("admin", () => {
  test("residents can't open admin pages", async ({ page, request }) => {
    const resident = await registerResident(request);
    await signIn(page, resident);
    for (const path of ["/stores", "/condominiums", "/admins"]) {
      await page.goto(path);
      await expect(page).toHaveURL("/");
    }
    await expect(page.getByRole("link", { name: "Stores" })).toHaveCount(0);
  });

  test("creates a store, stocks a product, renames and deletes the store", async ({ page, playwright }) => {
    await signInAsNewAdmin(page, playwright);
    const storeName = unique("Morning Show");
    const productTitle = unique("Blender");

    await page.goto("/stores");
    await expect(page.getByRole("heading", { name: "TV Show Stores" })).toBeVisible();
    await page.getByRole("button", { name: "New store" }).click();
    await field(page, "Store name").fill(storeName);
    await field(page, "Description").fill("Kitchen gadgets from the show");
    await page.getByRole("button", { name: "Create store" }).click();

    await page.goto("/stores");
    const card = page.getByRole("link").filter({ hasText: storeName });
    await expect(card).toContainText("0 products");
    await card.click();
    await expect(page.getByRole("heading", { name: storeName })).toBeVisible();
    await expect(page.getByText("QR code for TV")).toBeVisible();

    // Store products are new, direct-sale items with a stock count.
    await page.getByRole("link", { name: "Add product" }).click();
    await expect(page.getByRole("heading", { name: "Add a Store Product" })).toBeVisible();
    await expect(page.getByText("Select Listing Type")).toHaveCount(0);
    await field(page, "Item Name").fill(productTitle);
    await field(page, "Description").fill("Seen on the morning show");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByPlaceholder("75").fill("199");
    await field(page, "Units in stock").fill("5");
    await page.getByRole("button", { name: "Publish Listing" }).click();

    await expect(page).toHaveURL(/\/stores\/[\w-]+$/);
    await expect(page.getByText(productTitle)).toBeVisible();
    await expect(page.getByText("5 units in stock")).toBeVisible();
    await page.getByLabel("Units to add").fill("2");
    await page.getByRole("button", { name: "Add units" }).click();
    await expect(page.getByText("7 units in stock")).toBeVisible();

    const renamed = unique("Evening Show");
    await page.getByRole("button", { name: "Edit store" }).click();
    await field(page, "Store name").fill(renamed);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByRole("heading", { name: renamed })).toBeVisible();

    acceptNextDialog(
      page,
      `Delete the store "${renamed}"? Its QR code will stop working and its products will be taken off sale.`
    );
    await page.getByRole("button", { name: "Delete store" }).click();
    await expect(page).toHaveURL("/stores");
    await expect(page.getByRole("heading", { name: "TV Show Stores" })).toBeVisible();
    await expect(page.getByText(renamed)).toHaveCount(0);
  });

  test("adds and removes a condominium residents can sign up into", async ({ page, playwright }) => {
    const admin = await signInAsNewAdmin(page, playwright);
    const name = unique("Edifício Solar");
    // Keep the ZIP code lookup (an external service) out of the test.
    await page.route("**/api/cep/*", (route) => route.fulfill({ status: 404, json: { message: "CEP not found" } }));

    await page.goto("/condominiums");
    const add = page.getByRole("button", { name: "Add condominium" });
    await field(page, "Condominium name").fill(name);
    await expect(add).toBeDisabled(); // the address is still missing
    await field(page, "ZIP code").fill("04538-132");
    await field(page, "State").fill("SP");
    await field(page, "Street").fill("Avenida Faria Lima");
    await field(page, "Number").fill("3477");
    await field(page, "District").fill("Itaim Bibi");
    await field(page, "City").fill("São Paulo");
    await add.click();

    const row = page.locator("div.px-4.py-3").filter({ hasText: name });
    await expect(row).toContainText("Avenida Faria Lima, 3477, Itaim Bibi, São Paulo - SP, 04538-132");

    // It's now offered at sign-up.
    await page.context().clearCookies({ name: "vizo_token" });
    await page.goto("/register");
    await page.getByPlaceholder("Select your condominium").fill(name);
    await expect(page.getByRole("option", { name })).toBeVisible();

    // Removing it takes it off the sign-up list.
    await signIn(page, admin);
    await page.goto("/condominiums");
    acceptNextDialog(page, `Remove ${name} from the list? Current residents keep their community.`);
    await page.locator("div.px-4.py-3").filter({ hasText: name }).getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test("grants and revokes admin access", async ({ page, playwright, request }) => {
    const admin = await signInAsNewAdmin(page, playwright);
    const colleague = await registerResident(request, { name: unique("Colleague") });

    await page.goto("/admins");
    const me = page.locator("div.px-4.py-3").filter({ hasText: admin.email });
    await expect(me.getByText("You", { exact: true })).toBeVisible();
    await expect(me.getByRole("button", { name: "Remove" })).toHaveCount(0);

    await page.getByLabel("Email of an existing account").fill("nobody@e2e.test");
    await page.getByRole("button", { name: "Add admin" }).click();
    await expect(page.getByText("No account with this email. Ask them to sign up first.")).toBeVisible();

    await page.getByLabel("Email of an existing account").fill(colleague.email);
    await page.getByRole("button", { name: "Add admin" }).click();
    const row = page.locator("div.px-4.py-3").filter({ hasText: colleague.email });
    await expect(row).toBeVisible();

    acceptNextDialog(page, `Remove admin access for ${colleague.name}?`);
    await row.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(colleague.email)).toHaveCount(0);
  });
});
