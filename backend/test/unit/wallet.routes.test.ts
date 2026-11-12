import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app";
import { getWallet, withdrawCredits } from "../../src/db/credits";
import { BUYER_ID, authCookie } from "./fixtures";

vi.mock("../../src/db/credits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/db/credits")>()),
  getWallet: vi.fn(),
  withdrawCredits: vi.fn(),
}));

const wallet = { balance: 50, held: 10, transactions: [] };

beforeEach(() => {
  vi.mocked(getWallet).mockResolvedValue(wallet);
  vi.mocked(withdrawCredits).mockResolvedValue({ ok: true });
});

describe("GET /api/wallet", () => {
  it("requires a session", async () => {
    expect((await request(app).get("/api/wallet")).status).toBe(401);
  });

  it("returns the signed-in user's wallet", async () => {
    const res = await request(app).get("/api/wallet").set("Cookie", authCookie(BUYER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toEqual(wallet);
    expect(getWallet).toHaveBeenCalledWith(BUYER_ID);
  });
});

describe("POST /api/wallet/withdraw", () => {
  const withdraw = (body: object) =>
    request(app).post("/api/wallet/withdraw").set("Cookie", authCookie(BUYER_ID)).send(body);

  it("withdraws and returns the updated wallet", async () => {
    const res = await withdraw({ amount: 12.5, pixKey: " ana@pix " });
    expect(res.status).toBe(201);
    expect(withdrawCredits).toHaveBeenCalledWith({ userId: BUYER_ID, amount: 12.5, pixKey: "ana@pix" });
  });

  it.each([
    ["zero", { amount: 0, pixKey: "k" }],
    ["negative", { amount: -5, pixKey: "k" }],
    ["three decimals", { amount: 1.005, pixKey: "k" }],
    ["a string amount", { amount: "10", pixKey: "k" }],
    ["a blank pix key", { amount: 10, pixKey: "  " }],
  ])("rejects %s", async (_label, body) => {
    expect((await withdraw(body)).status).toBe(400);
    expect(withdrawCredits).not.toHaveBeenCalled();
  });

  it("accepts amounts whose float representation is slightly off", async () => {
    expect((await withdraw({ amount: 0.1 + 0.2, pixKey: "k" })).status).toBe(201);
  });

  it("passes on an insufficient balance as 400", async () => {
    vi.mocked(withdrawCredits).mockResolvedValue({ ok: false, reason: "Not enough" });
    const res = await withdraw({ amount: 1000, pixKey: "k" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Not enough");
  });
});
