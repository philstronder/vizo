import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import pg from "pg";
import { E2E_DATABASE_URL } from "../env";

// Tests run in parallel against one database, so each one creates its own
// condominium and users with unique names instead of sharing fixtures. Listings
// are scoped to a condominium, so tests can't see each other's data.

export const PASSWORD = "secret123";

let counter = 0;
export function unique(prefix: string) {
  counter += 1;
  return `${prefix} ${Date.now().toString(36)}${process.pid.toString(36)}${counter}`;
}

const ADDRESS = {
  postalCode: "01310-100",
  street: "Avenida Paulista",
  number: "1000",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
};

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password: string;
  buildingName?: string;
}

// All API helpers go through the frontend's /api rewrite, exactly like the browser.
async function ok<T>(response: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<T> {
  if (!response.ok()) throw new Error(`${response.url()} → ${response.status()}: ${await response.text()}`);
  return response.status() === 204 ? (undefined as T) : ((await response.json()) as T);
}

// Registers a resident. Without `buildingName` it adds a brand-new condominium,
// giving the test its own isolated community.
export async function registerResident(
  request: APIRequestContext,
  opts: { buildingName?: string; name?: string } = {}
): Promise<TestUser> {
  const name = opts.name ?? unique("Resident");
  const email = `${name.replace(/\W+/g, ".").toLowerCase()}@e2e.test`;
  const body = {
    accountType: "resident",
    name,
    email,
    password: PASSWORD,
    unitNumber: "12B",
    buildingBlock: "A",
    ...(opts.buildingName
      ? { buildingName: opts.buildingName }
      : { newCondominium: { name: unique("Condo"), address: ADDRESS } }),
  };
  const user = await ok<{ id: string; buildingName: string }>(await request.post("/api/auth/register", { data: body }));
  return { id: user.id, name, email, password: PASSWORD, buildingName: user.buildingName };
}

// Signs the page's browser context in (the auth cookie lands in its jar).
export async function signIn(page: Page, user: TestUser) {
  await ok(await page.request.post("/api/auth/login", { data: { email: user.email, password: user.password } }));
}

export async function createListing(
  request: APIRequestContext,
  data: Partial<{
    title: string;
    description: string;
    type: "direct" | "auction";
    price: number;
    startingPrice: number;
    storeId: string;
    quantity: number;
    condition: string;
  }> = {}
): Promise<{ id: string; title: string }> {
  const type = data.type ?? "direct";
  return ok(
    await request.post("/api/listings", {
      data: {
        title: unique("Item"),
        description: "Created by an e2e test",
        category: "furniture",
        condition: data.storeId ? "new" : "used-good",
        ...(type === "direct" ? { price: 100 } : { startingPrice: 50, auctionDurationDays: 3 }),
        ...data,
        type,
      },
    })
  );
}

export async function createStore(request: APIRequestContext, name = unique("Store")) {
  return ok<{ id: string; name: string }>(
    await request.post("/api/stores", { data: { name, description: "An e2e TV show store" } })
  );
}

async function sql(text: string, params: unknown[]) {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    await client.query(text, params);
  } finally {
    await client.end();
  }
}

// There's no API for the first admin (it's a CLI script), so flip the flag directly.
export async function makeAdmin(user: TestUser) {
  await sql("UPDATE users SET is_admin = TRUE WHERE id = $1", [user.id]);
}

// Credits only come from sales and refunds, so grant them as a refund.
export async function giveCredits(user: TestUser, amount: number) {
  await sql("INSERT INTO credit_transactions (user_id, type, amount) VALUES ($1, 'refund', $2)", [user.id, amount]);
}

// Buys a listing as whoever the page is signed in as, proposing a meetup tomorrow.
export async function checkout(page: Page, listingId: string) {
  return ok<{ id: string }>(
    await page.request.post("/api/orders", {
      data: {
        listingId,
        pickupLocation: "Lobby",
        meetupAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    })
  );
}

// The order row on /orders for a listing title.
export function orderRow(page: Page, title: string): Locator {
  return page.locator("div.py-3").filter({ has: page.getByText(title, { exact: true }) });
}

// The form's <label>s aren't tied to their inputs, so find the control that
// follows a label with this exact text.
export function field(scope: Page | Locator, label: string): Locator {
  return scope
    .locator(
      `xpath=//label[normalize-space()=${JSON.stringify(label)}]/following-sibling::*[1]` +
        "/descendant-or-self::*[self::input or self::select or self::textarea][1]"
    )
    .first();
}

// A datetime-local value a day from now, in the browser's local time.
export function tomorrowLocal() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function expectSignedOut(page: Page) {
  await expect(page.getByRole("link", { name: "Sign In" }).or(page.getByRole("button", { name: "Sign In" })).first()).toBeVisible();
}
