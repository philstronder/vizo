import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app";
import { createUser, findUserByEmail, findUserById, updateUser } from "../../src/db/users";
import { createCondominium, findCondominiumByName } from "../../src/db/condominiums";
import { hashPassword } from "../../src/lib/password";
import { notifyResidencySubmitted } from "../../src/lib/residency";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "../../src/lib/jwt";
import { BUYER_ID, authCookie, makeUserRow } from "./fixtures";

vi.mock("../../src/db/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/db/users")>()),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
}));
// No building admins, and notifications go nowhere.
vi.mock("../../src/db/residency", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/db/residency")>()),
  condominiumsAdministeredBy: vi.fn(async () => []),
}));
vi.mock("../../src/lib/residency", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/residency")>()),
  notifyResidencySubmitted: vi.fn(async () => {}),
}));
vi.mock("../../src/db/condominiums", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/db/condominiums")>()),
  createCondominium: vi.fn(),
  findCondominiumByName: vi.fn(),
}));

const condominium = {
  id: "c1",
  name: "Edifício Aurora",
  address_postal_code: null,
  address_street: null,
  address_number: null,
  address_complement: null,
  address_district: null,
  address_city: null,
  address_state: null,
  created_at: new Date(),
};

const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

const resident = {
  name: "Ana",
  email: "ana@example.com",
  password: "secret123",
  unitNumber: "42",
  buildingName: "edifício aurora",
  proofPhoto: PHOTO,
};

function authTokenFrom(res: request.Response): string | undefined {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const cookie = cookies.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
  return cookie?.split(";")[0].split("=")[1];
}

beforeEach(() => {
  vi.mocked(findUserByEmail).mockResolvedValue(null);
  vi.mocked(createUser).mockImplementation(async (input) =>
    makeUserRow({
      name: input.name,
      email: input.email,
      building_name: input.buildingName ?? null,
      verified: input.proofPhoto === undefined,
    })
  );
});

describe("POST /api/auth/register", () => {
  it("registers a resident under the condominium list's spelling and signs them in", async () => {
    vi.mocked(findCondominiumByName).mockResolvedValue(condominium);

    const res = await request(app).post("/api/auth/register").send(resident);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "ana@example.com", buildingName: "Edifício Aurora" });
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(vi.mocked(createUser).mock.calls[0][0]).toMatchObject({ buildingName: "Edifício Aurora", unitNumber: "42" });
    expect(vi.mocked(createUser).mock.calls[0][0].passwordHash).not.toBe("secret123");
    expect(verifyAuthToken(authTokenFrom(res)!).userId).toBe(BUYER_ID);
  });

  it("keeps the resident pending until their proof of residency is reviewed", async () => {
    vi.mocked(findCondominiumByName).mockResolvedValue(condominium);
    const res = await request(app).post("/api/auth/register").send(resident);
    expect(res.body).toMatchObject({ verified: false, verificationStatus: "pending", buildingAdminOf: [] });
    expect(vi.mocked(createUser).mock.calls[0][0].proofPhoto).toBe(PHOTO);
    expect(notifyResidencySubmitted).toHaveBeenCalledOnce();
  });

  it("requires a proof of residency that is an image", async () => {
    vi.mocked(findCondominiumByName).mockResolvedValue(condominium);
    for (const proofPhoto of [undefined, "", "data:text/html;base64,PGh0bWw+", "https://example.com/bill.jpg"]) {
      const res = await request(app).post("/api/auth/register").send({ ...resident, proofPhoto });
      expect(res.status).toBe(400);
      expect(res.body.issues[0].path).toEqual(["proofPhoto"]);
    }
    expect(createUser).not.toHaveBeenCalled();
  });

  it("sets an httpOnly auth cookie", async () => {
    vi.mocked(findCondominiumByName).mockResolvedValue(condominium);
    const res = await request(app).post("/api/auth/register").send(resident);
    expect(String(res.headers["set-cookie"])).toMatch(/HttpOnly/i);
  });

  it("rejects a condominium that isn't on the list", async () => {
    vi.mocked(findCondominiumByName).mockResolvedValue(null);
    const res = await request(app).post("/api/auth/register").send(resident);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Choose a condominium from the list");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("adds a missing condominium", async () => {
    vi.mocked(createCondominium).mockResolvedValue({ ...condominium, name: "Torre Nova" });
    const { buildingName: _, ...rest } = resident;
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        ...rest,
        newCondominium: {
          name: "Torre Nova",
          address: {
            postalCode: "01310-100",
            street: "Av. Paulista",
            number: "1",
            district: "Bela Vista",
            city: "São Paulo",
            state: "SP",
          },
        },
      });
    expect(res.status).toBe(201);
    expect(res.body.buildingName).toBe("Torre Nova");
  });

  it("answers 409 when the email is taken", async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(makeUserRow());
    const res = await request(app).post("/api/auth/register").send(resident);
    expect(res.status).toBe(409);
  });

  it("validates the payload", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...resident, password: "123" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid request");
    expect(res.body.issues[0].path).toEqual(["password"]);
  });

  it("registers a viewer with a phone and address instead of a building", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        accountType: "viewer",
        name: "Vera",
        email: "vera@example.com",
        password: "secret123",
        phone: "11999999999",
        deliveryAddress: {
          postalCode: "01310-100",
          street: "Av. Paulista",
          number: "1",
          district: "Bela Vista",
          city: "São Paulo",
          state: "SP",
        },
      });
    expect(res.status).toBe(201);
    expect(findCondominiumByName).not.toHaveBeenCalled();
    expect(vi.mocked(createUser).mock.calls[0][0]).toMatchObject({ phone: "11999999999" });
    expect(vi.mocked(createUser).mock.calls[0][0].buildingName).toBeUndefined();
    expect(vi.mocked(createUser).mock.calls[0][0].proofPhoto).toBeUndefined();
    expect(res.body.verificationStatus).toBe("approved");
    expect(notifyResidencySubmitted).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  it("signs in with the right password", async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(makeUserRow({ password_hash: await hashPassword("secret123") }));
    const res = await request(app).post("/api/auth/login").send({ email: "ana@example.com", password: "secret123" });
    expect(res.status).toBe(200);
    expect(authTokenFrom(res)).toBeTruthy();
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    vi.mocked(findUserByEmail).mockResolvedValueOnce(makeUserRow({ password_hash: await hashPassword("secret123") }));
    const wrongPassword = await request(app).post("/api/auth/login").send({ email: "ana@example.com", password: "nope" });
    const unknownEmail = await request(app).post("/api/auth/login").send({ email: "x@example.com", password: "nope" });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid email or password");
      expect(authTokenFrom(res)).toBeUndefined();
    }
  });
});

describe("GET /api/auth/me", () => {
  it("requires a session", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  it("treats an invalid token as signed out", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", `${AUTH_COOKIE_NAME}=garbage`);
    expect(res.status).toBe(401);
  });

  it("returns the signed-in user", async () => {
    vi.mocked(findUserById).mockResolvedValue(makeUserRow());
    const res = await request(app).get("/api/auth/me").set("Cookie", authCookie(BUYER_ID));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(BUYER_ID);
  });
});

describe("PATCH /api/auth/me", () => {
  it("requires building name and unit number together", async () => {
    const res = await request(app)
      .patch("/api/auth/me")
      .set("Cookie", authCookie(BUYER_ID))
      .send({ name: "Ana", buildingName: "Aurora" });
    expect(res.status).toBe(400);
  });

  it("keeps the current building's saved spelling without consulting the list", async () => {
    vi.mocked(findUserById).mockResolvedValue(makeUserRow());
    vi.mocked(updateUser).mockResolvedValue(makeUserRow());
    const res = await request(app)
      .patch("/api/auth/me")
      .set("Cookie", authCookie(BUYER_ID))
      .send({ name: "Ana", buildingName: " EDIFÍCIO AURORA ", unitNumber: "43" });
    expect(res.status).toBe(200);
    expect(findCondominiumByName).not.toHaveBeenCalled();
    expect(vi.mocked(updateUser).mock.calls[0][1].buildingName).toBe("Edifício Aurora");
    // Staying in the same building needs no new proof.
    expect(vi.mocked(updateUser).mock.calls[0][1].proofPhoto).toBeUndefined();
  });

  it("asks for a new proof of residency when moving to another building", async () => {
    vi.mocked(findUserById).mockResolvedValue(makeUserRow());
    vi.mocked(findCondominiumByName).mockResolvedValue({ ...condominium, name: "Torre Boreal" });
    vi.mocked(updateUser).mockResolvedValue(makeUserRow({ building_name: "Torre Boreal", verified: false }));
    const move = { name: "Ana", buildingName: "torre boreal", unitNumber: "1" };

    const withoutProof = await request(app).patch("/api/auth/me").set("Cookie", authCookie(BUYER_ID)).send(move);
    expect(withoutProof.status).toBe(400);
    expect(withoutProof.body.code).toBe("residency_proof_required");
    expect(updateUser).not.toHaveBeenCalled();

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Cookie", authCookie(BUYER_ID))
      .send({ ...move, proofPhoto: PHOTO });
    expect(res.status).toBe(200);
    expect(vi.mocked(updateUser).mock.calls[0][1]).toMatchObject({ buildingName: "Torre Boreal", proofPhoto: PHOTO });
    expect(res.body.verificationStatus).toBe("pending");
    expect(notifyResidencySubmitted).toHaveBeenCalledOnce();
  });

  it("rejects moving to a condominium that isn't on the list", async () => {
    vi.mocked(findUserById).mockResolvedValue(makeUserRow());
    vi.mocked(findCondominiumByName).mockResolvedValue(null);
    const res = await request(app)
      .patch("/api/auth/me")
      .set("Cookie", authCookie(BUYER_ID))
      .send({ name: "Ana", buildingName: "Somewhere else", unitNumber: "1" });
    expect(res.status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the auth cookie", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(204);
    expect(String(res.headers["set-cookie"])).toMatch(new RegExp(`${AUTH_COOKIE_NAME}=;`));
  });
});
