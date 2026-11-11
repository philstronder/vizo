import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app";

function mockViaCep(response: Partial<Response> | Error) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/cep/:cep", () => {
  it("normalizes the CEP and maps ViaCEP's fields", async () => {
    const fetchMock = mockViaCep({
      ok: true,
      json: async () => ({ logradouro: "Av. Paulista", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP" }),
    });

    const res = await request(app).get("/api/cep/01310-100");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      postalCode: "01310-100",
      street: "Av. Paulista",
      district: "Bela Vista",
      city: "São Paulo",
      state: "SP",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://viacep.com.br/ws/01310100/json/");
  });

  it("rejects a CEP without 8 digits without calling ViaCEP", async () => {
    const fetchMock = mockViaCep(new Error("should not be called"));
    expect((await request(app).get("/api/cep/123")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown CEP", async () => {
    mockViaCep({ ok: true, json: async () => ({ erro: "true" }) });
    expect((await request(app).get("/api/cep/99999999")).status).toBe(404);
  });

  it("answers 502 when ViaCEP is down", async () => {
    mockViaCep({ ok: false, status: 503 });
    expect((await request(app).get("/api/cep/01310100")).status).toBe(502);
  });

  it("answers 502 when ViaCEP can't be reached", async () => {
    mockViaCep(new Error("ECONNRESET"));
    expect((await request(app).get("/api/cep/01310100")).status).toBe(502);
  });
});
