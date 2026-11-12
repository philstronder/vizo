import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, checkout, fetchListings, fetchMe, logout, withdrawCredits } from "@/lib/api";

const fetchMock = vi.fn<typeof fetch>();

function respond(status: number, body?: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      statusText: status === 500 ? "Internal Server Error" : "",
      headers: { "Content-Type": "application/json" },
    })
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

describe("request", () => {
  it("sends credentialed JSON requests", async () => {
    respond(201, { balance: 10, held: 0, transactions: [] });

    await expect(withdrawCredits(10, "ana@pix")).resolves.toEqual({ balance: 10, held: 0, transactions: [] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/wallet/withdraw");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual({ amount: 10, pixKey: "ana@pix" });
  });

  it("throws an ApiError with the server's message and status", async () => {
    respond(400, { message: "You don't have enough credits" });
    const err = await withdrawCredits(1000, "k").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: "You don't have enough credits" });
  });

  it("falls back to the status text when the error body isn't JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>oops</html>", { status: 500, statusText: "Internal Server Error" }));
    await expect(checkout({ listingId: "l1" })).rejects.toMatchObject({ status: 500, message: "Internal Server Error" });
  });

  it("resolves 204 responses to undefined", async () => {
    respond(204);
    await expect(logout()).resolves.toBeUndefined();
  });
});

describe("fetchMe", () => {
  it("returns null when signed out", async () => {
    respond(401, { message: "Not authenticated" });
    await expect(fetchMe()).resolves.toBeNull();
  });

  it("rethrows other errors", async () => {
    respond(500, { message: "Internal server error" });
    await expect(fetchMe()).rejects.toMatchObject({ status: 500 });
  });
});

describe("fetchListings", () => {
  it("only sends the filters that are set, URL-encoded", async () => {
    respond(200, []);
    await fetchListings({ category: "books", q: "café & pão", type: undefined, sellerId: "" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/listings?category=books&q=caf%C3%A9+%26+p%C3%A3o");
  });

  it("omits the query string without filters", async () => {
    respond(200, []);
    await fetchListings();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/listings");
  });
});
