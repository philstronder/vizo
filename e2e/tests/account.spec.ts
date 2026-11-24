import { expect, test } from "@playwright/test";
import { checkout, createListing, field, registerResident, signIn, unique } from "./helpers";

test.describe("profile", () => {
  test("a resident edits their details and deletes one of their listings", async ({ page, request }) => {
    const user = await registerResident(request);
    const keep = await createListing(request, { title: unique("Keep Me") });
    const remove = await createListing(request, { title: unique("Delete Me") });
    await signIn(page, user);

    await page.goto("/profile");
    await expect(page.getByText(`Unit 12B · ${user.buildingName}`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Listings" })).toBeVisible();
    await expect(page.getByText(keep.title)).toBeVisible();

    await page.getByRole("button", { name: "Edit Profile Details" }).click();
    const newName = unique("Renamed");
    await field(page, "Name").fill(newName);
    await field(page, "Unit Number").fill("901");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText(newName, { exact: true })).toBeVisible();
    await expect(page.getByText(`Unit 901 · ${user.buildingName}`)).toBeVisible();

    page.once("dialog", (dialog) => {
      expect(dialog.message()).toBe(`Delete "${remove.title}"?`);
      void dialog.accept();
    });
    const card = page.locator("div.overflow-hidden").filter({ hasText: remove.title });
    await card.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(remove.title)).toHaveCount(0);
    await expect(page.getByText(keep.title)).toBeVisible();

    // Still gone after a reload.
    await page.reload();
    await expect(page.getByText(keep.title)).toBeVisible();
    await expect(page.getByText(remove.title)).toHaveCount(0);
  });
});

test.describe("feed", () => {
  test("searching, filtering and sorting the building's listings", async ({ page, request }) => {
    const seller = await registerResident(request);
    const desk = await createListing(request, { title: unique("Oak Desk"), price: 300 });
    const lamp = await createListing(request, { title: unique("Brass Lamp"), price: 40 });
    const piano = await createListing(request, { title: unique("Piano"), type: "auction", startingPrice: 900 });
    const neighbor = await registerResident(request, { buildingName: seller.buildingName });
    await signIn(page, neighbor);

    await page.goto("/");
    await expect(page.getByText("3 listings")).toBeVisible();

    // Header search.
    await page.getByPlaceholder("Search listings...").first().fill("oak");
    await page.getByPlaceholder("Search listings...").first().press("Enter");
    await expect(page).toHaveURL("/?q=oak");
    await expect(page.getByText(desk.title)).toBeVisible();
    await expect(page.getByText(lamp.title)).toHaveCount(0);
    await expect(page.getByText("1 listing matching “oak”")).toBeVisible();

    await page.goto("/");
    await page.getByLabel("Auction", { exact: true }).check();
    await expect(page.getByText(piano.title)).toBeVisible();
    await expect(page.getByText(desk.title)).toHaveCount(0);
    await page.getByLabel("All", { exact: true }).check();

    // Cheapest first, then dearest first.
    const titles = page.locator("a[href^='/listing/'] h3, a[href^='/listing/'] p.font-semibold").filter({
      hasText: /Oak Desk|Brass Lamp|Piano/,
    });
    await page.getByRole("combobox").filter({ hasText: "Newest" }).selectOption("price-asc");
    await expect(titles.first()).toHaveText(lamp.title);
    await page.getByRole("combobox").filter({ hasText: "Newest" }).selectOption("price-desc");
    await expect(titles.first()).toHaveText(piano.title);

    // A category with nothing in it.
    await page.getByLabel("Books", { exact: true }).check();
    await expect(page.getByText("No listings match your filters")).toBeVisible();
  });
});

test.describe("listing Q&A", () => {
  test("a neighbor asks a question and the seller answers it", async ({ page, playwright }) => {
    const api = await playwright.request.newContext();
    const seller = await registerResident(api);
    const listing = await createListing(api, { title: unique("Sofa") });
    const neighbor = await registerResident(api, { buildingName: seller.buildingName, name: unique("Asker") });
    await api.dispose();

    await signIn(page, neighbor);
    await page.goto(`/listing/${listing.id}`);
    await expect(page.getByText("No questions yet. Ask the seller something.")).toBeVisible();
    await page.getByPlaceholder("Ask a question...").fill("Does it come apart for the elevator?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Does it come apart for the elevator?")).toBeVisible();

    await signIn(page, seller);
    await page.goto(`/listing/${listing.id}`);
    await expect(page.getByText("Does it come apart for the elevator?")).toBeVisible();
    await page.getByPlaceholder("Ask a question...").fill("Yes, the legs unscrew.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Yes, the legs unscrew.")).toBeVisible();
  });
});

test.describe("notifications", () => {
  test("a seller is notified of a sale and marks everything read", async ({ page, playwright }) => {
    const api = await playwright.request.newContext();
    const seller = await registerResident(api);
    const listing = await createListing(api, { title: unique("Toaster") });
    const buyer = await registerResident(api, { buildingName: seller.buildingName });
    await api.dispose();
    await signIn(page, buyer);
    await checkout(page, listing.id);

    await signIn(page, seller);
    await page.goto("/orders");
    const bell = page.getByRole("link", { name: "Notifications" });
    await expect(bell).toHaveText("1");
    await expect(page.getByText(`${listing.title} sold!`)).toBeVisible();

    await page.getByRole("button", { name: "Mark all read" }).click();
    await expect(page.getByRole("button", { name: "Mark all read" })).toHaveCount(0);
    await page.reload();
    await expect(bell).toHaveText("");
  });
});

test.describe("language", () => {
  test("switching to Portuguese persists across reloads", async ({ page, request }) => {
    const user = await registerResident(request);
    await signIn(page, user);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Marketplace Feed" })).toBeVisible();

    await page.getByLabel("Language").selectOption("pt-BR");
    await expect(page.getByRole("heading", { name: "Anúncios", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
    await expect(page.getByRole("heading", { name: "Anúncios", exact: true })).toBeVisible();

    await page.getByLabel("Idioma").selectOption("en-US");
    await expect(page.getByRole("heading", { name: "Marketplace Feed" })).toBeVisible();
  });
});
