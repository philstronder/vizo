import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/error-message";

const pt = getDictionary("pt-BR");

describe("errorMessage", () => {
  it("translates a known API error code", () => {
    const err = new ApiError("Agree on the meetup time before confirming the handoff", 409, "meetup_not_agreed");
    expect(errorMessage(err, pt, "pt-BR", "fallback")).toBe(
      "Combine o horário do encontro antes de confirmar a entrega."
    );
  });

  it("translates the order status inside the message", () => {
    const err = new ApiError("This order is already completed", 409, "order_already_status", { status: "completed" });
    expect(errorMessage(err, pt, "pt-BR", "fallback")).toBe("Este pedido já está com status “Concluído”.");
  });

  it("keeps the server message for an API error without a known code", () => {
    expect(errorMessage(new ApiError("Teapot", 418), pt, "pt-BR", "fallback")).toBe("Teapot");
  });

  it("uses the fallback for errors that didn't come from the API", () => {
    expect(errorMessage(new TypeError("Failed to fetch"), pt, "pt-BR", "Falhou")).toBe("Falhou");
  });
});
