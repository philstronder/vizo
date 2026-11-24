import { expect, test, type Page } from "@playwright/test";
import {
  createListing,
  field,
  makeAdmin,
  makeBuildingAdmin,
  PROOF_PNG,
  registerResident,
  signIn,
  unique,
  type TestUser,
} from "./helpers";

// Building admins, nominated by platform admins, approve or reject the proofs
// of residency of people signing up to their condominium.

function requestCard(page: Page, user: TestUser) {
  return page.getByRole("article", { name: user.name });
}

test.describe("residency verification", () => {
  test("a platform admin nominates a building admin, who approves a new neighbor", async ({ browser, request }) => {
    const admin = await registerResident(request, { name: unique("Admin") });
    await makeAdmin(admin);
    const manager = await registerResident(request, { name: unique("Manager") });
    const seller = await registerResident(request, { name: unique("Seller") });
    const item = await createListing(request, { title: unique("Armchair") });
    const newcomer = await registerResident(request, { buildingName: seller.buildingName, pending: true });

    // The platform admin nominates the manager for the seller's condominium.
    const adminPage = await (await browser.newContext()).newPage();
    await signIn(adminPage, admin);
    await adminPage.goto("/admins");
    await expect(adminPage.getByRole("heading", { name: "Building admins" })).toBeVisible();
    const condo = adminPage.getByPlaceholder("Select your condominium");
    await condo.fill(seller.buildingName!);
    await adminPage.getByRole("option", { name: seller.buildingName! }).click();
    await adminPage.getByLabel("Email of the building admin").fill(manager.email);
    await adminPage.getByRole("button", { name: "Add building admin" }).click();
    await expect(adminPage.locator("div.px-4.py-3").filter({ hasText: manager.email })).toContainText(seller.buildingName!);

    // The newcomer can't see the community yet.
    const newcomerPage = await (await browser.newContext()).newPage();
    await signIn(newcomerPage, newcomer);
    await newcomerPage.goto("/");
    await expect(newcomerPage.getByRole("heading", { name: "Your residency is being reviewed" })).toBeVisible();
    await expect(newcomerPage.getByText(item.title)).toHaveCount(0);

    // The manager reviews the request.
    const managerPage = await (await browser.newContext()).newPage();
    await signIn(managerPage, manager);
    await managerPage.goto("/");
    await managerPage.getByRole("link", { name: "Verifications" }).first().click();
    await expect(managerPage.getByRole("heading", { name: "Residency verifications" })).toBeVisible();
    const card = requestCard(managerPage, newcomer);
    await expect(card.getByAltText(`Proof of residency of ${newcomer.name}`)).toBeVisible();
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(managerPage.getByText(newcomer.email)).toHaveCount(0);

    // Now the newcomer is in.
    await newcomerPage.reload();
    await expect(newcomerPage.getByRole("heading", { name: "Marketplace Feed" })).toBeVisible();
    await expect(newcomerPage.getByText(item.title)).toBeVisible();
    await newcomerPage.goto("/orders");
    await expect(newcomerPage.getByText(`Welcome to ${seller.buildingName}`)).toBeVisible();
  });

  test("a rejected resident sees the reason and sends a new photo", async ({ browser, request }) => {
    const manager = await registerResident(request, { name: unique("Manager") });
    await makeBuildingAdmin(manager, manager.buildingName!);
    const newcomer = await registerResident(request, { buildingName: manager.buildingName, pending: true });

    const managerPage = await (await browser.newContext()).newPage();
    await signIn(managerPage, manager);
    await managerPage.goto("/verifications");
    const card = requestCard(managerPage, newcomer);
    await card.getByRole("button", { name: "Reject" }).click();
    await field(card, "Reason (shown to the resident)").fill("The bill is too blurry");
    await card.getByRole("button", { name: "Reject request" }).click();
    await expect(managerPage.getByText("All caught up")).toBeVisible();

    const page = await (await browser.newContext()).newPage();
    await signIn(page, newcomer);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your proof of residency wasn't approved" })).toBeVisible();
    await expect(page.getByText("Reason: The bill is too blurry")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({ name: "lease.png", mimeType: "image/png", buffer: PROOF_PNG });
    await page.getByRole("button", { name: "Send new photo" }).click();
    await expect(page.getByRole("heading", { name: "Your residency is being reviewed" })).toBeVisible();

    await managerPage.reload();
    await expect(managerPage.getByText(newcomer.email)).toBeVisible();
  });

  test("residents can't open the review queue", async ({ page, request }) => {
    const resident = await registerResident(request);
    await signIn(page, resident);
    await page.goto("/verifications");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("link", { name: "Verifications" })).toHaveCount(0);
  });
});
