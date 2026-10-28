import { Router } from "express";
import { badRequest, HttpError, notFound } from "../lib/http-error";

// Looks up a Brazilian postal code (CEP) on ViaCEP so address forms can fill
// in street, district, city and state. Public, since viewer sign-up uses it.
export const cepRouter = Router();

interface ViaCepResponse {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

cepRouter.get("/:cep", async (req, res, next) => {
  try {
    const cep = (req.params.cep as string).replace(/\D/g, "");
    if (cep.length !== 8) throw badRequest("CEP must have 8 digits");

    let data: ViaCepResponse;
    try {
      const upstream = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!upstream.ok) throw new Error(`ViaCEP responded ${upstream.status}`);
      data = (await upstream.json()) as ViaCepResponse;
    } catch {
      throw new HttpError(502, "CEP lookup is unavailable");
    }
    if (data.erro) throw notFound("CEP not found");

    res.json({
      postalCode: `${cep.slice(0, 5)}-${cep.slice(5)}`,
      street: data.logradouro ?? "",
      district: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
    });
  } catch (err) {
    next(err);
  }
});
