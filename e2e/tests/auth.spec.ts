import { expect, test } from "@playwright/test";
import { expectSignedOut, field, PASSWORD, registerResident, unique } from "./helpers";

test.describe("authentication", () => {
  test("a resident signs up through the form and lands on their building's feed", async ({ page, request }) => {
    // An existing neighbor puts the condominium on the list to pick from.
    const neighbor = await registerResident(request);
    const name = unique("New Resident");

    await page.goto("/register");
    await field(page, "Name").fill(name);
    await field(page, "Email").fill(`${name.replace(/\W+/g, ".").toLowerCase()}@e2e.test`);
    await field(page, "Password").fill(PASSWORD);

    const building = page.getByPlaceholder("Select your condominium");
    await building.fill(neighbor.buildingName!);
    await page.getByRole("option", { name: neighbor.buildingName! }).click();
    await expect(building).toHaveValue(neighbor.buildingName!);
    await field(page, "Unit Number").fill("7C");

    const submit = page.getByRole("button", { name: "Create Account" });
    await expect(submit).toBeDisabled(); // proof of residency still missing
    await page.locator('input[type="file"]').setInputFiles({
      name: "utility-bill.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake image"),
    });
    await expect(page.getByText("utility-bill.png uploaded")).toBeVisible();
    await submit.click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Marketplace Feed" })).toBeVisible();
    await expect(page.getByText(`${neighbor.buildingName} Marketplace`)).toBeVisible();
  });

  test("signing in, out, and rejecting a wrong password", async ({ page, request }) => {
    const user = await registerResident(request);

    await page.goto("/login");
    await field(page, "Email").fill(user.email);
    await field(page, "Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();

    await field(page, "Password").fill(user.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Marketplace Feed" })).toBeVisible();

    // Survives a reload: the session lives in the httpOnly cookie.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Marketplace Feed" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expectSignedOut(page);
  });

  test("protected pages send signed-out visitors to sign in, then back", async ({ page, request }) => {
    const user = await registerResident(request);

    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login\?next=%2Forders$/);

    await field(page, "Email").fill(user.email);
    await field(page, "Password").fill(user.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/orders");
    await expect(page.getByRole("heading", { name: "Purchases" })).toBeVisible();
  });
});
