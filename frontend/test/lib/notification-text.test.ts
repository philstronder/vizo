import { describe, expect, it } from "vitest";
import { getDictionary } from "@/i18n/dictionaries";
import { notificationText } from "@/lib/notification-text";
import type { Notification } from "@/types";

const base: Notification = {
  id: "n1",
  type: "delivery_confirmed",
  title: "Bike: confirm the handoff",
  body: "Ana confirmed the handoff. Confirm it too to complete the order.",
  read: false,
  createdAt: "2026-11-23T10:00:00.000Z",
  params: { listingTitle: "Bike", actorName: "Ana" },
};

describe("notificationText", () => {
  it("renders the handoff notification in Portuguese", () => {
    expect(notificationText(base, getDictionary("pt-BR"), "pt-BR")).toEqual({
      title: "Bike: confirme a entrega",
      body: "Ana confirmou a entrega. Confirme também para concluir o pedido.",
    });
  });

  it("renders the same notification in English", () => {
    expect(notificationText(base, getDictionary("en-US"), "en-US")).toEqual({
      title: base.title,
      body: base.body,
    });
  });

  it("tells the other side a community order is complete", () => {
    const n: Notification = {
      ...base,
      type: "order_completed",
      params: { listingTitle: "Bike", actorName: "Ana", variant: "handoff" },
    };
    expect(notificationText(n, getDictionary("en-US"), "en-US").body).toBe(
      "Ana confirmed the handoff. The order is complete.",
    );
    expect(notificationText(n, getDictionary("pt-BR"), "pt-BR").body).toBe(
      "Ana confirmou a entrega. O pedido foi concluído.",
    );
  });

  // Sent before rating became part of confirming the handoff.
  it("asks the seller to rate the buyer once the order completes", () => {
    const n: Notification = {
      ...base,
      type: "order_completed",
      params: { listingTitle: "Bike", actorName: "Ana", variant: "rateBuyer" },
    };
    expect(notificationText(n, getDictionary("en-US"), "en-US")).toEqual({
      title: "Bike delivered",
      body: "Ana confirmed the handoff. Rate the buyer so other sellers know how it went.",
    });
  });

  it("asks the buyer to rate the seller once the order completes, in Portuguese", () => {
    const n: Notification = {
      ...base,
      type: "order_completed",
      params: { listingTitle: "Bike", actorName: "Bruno", variant: "rateSeller" },
    };
    expect(notificationText(n, getDictionary("pt-BR"), "pt-BR")).toEqual({
      title: "Bike entregue",
      body: "Bruno confirmou a entrega. Avalie o vendedor para que outros compradores saibam como foi.",
    });
  });

  it("keeps the plain delivered text for store orders", () => {
    const n: Notification = { ...base, type: "order_completed", params: { listingTitle: "Bike", actorName: "Ana" } };
    expect(notificationText(n, getDictionary("en-US"), "en-US").body).toBe("Ana marked this order as delivered.");
  });

  it("keeps a chat message body as the sender wrote it", () => {
    const n: Notification = {
      ...base,
      type: "message",
      body: "Hi there",
      params: { listingTitle: "Bike", actorName: "Ana", variant: "order" },
    };
    expect(notificationText(n, getDictionary("pt-BR"), "pt-BR")).toEqual({
      title: "Ana enviou uma mensagem sobre Bike",
      body: "Hi there",
    });
  });

  it("falls back to the stored text for notifications without params", () => {
    const n: Notification = { ...base, params: undefined };
    expect(notificationText(n, getDictionary("pt-BR"), "pt-BR")).toEqual({
      title: base.title,
      body: base.body,
    });
  });

  it("renders proof of residency notifications from the building name", () => {
    const pt = getDictionary("pt-BR");
    const submitted: Notification = { ...base, type: "residency_submitted", params: { actorName: "Ana", buildingName: "Aurora" } };
    expect(notificationText(submitted, pt, "pt-BR")).toEqual({
      title: "Ana quer entrar no Aurora",
      body: "Analise o comprovante de residência.",
    });
    const approved: Notification = { ...base, type: "residency_approved", params: { buildingName: "Aurora" } };
    expect(notificationText(approved, getDictionary("en-US"), "en-US").title).toBe("Welcome to Aurora");
    const rejected: Notification = {
      ...base,
      type: "residency_rejected",
      params: { buildingName: "Aurora", reason: "Blurry photo" },
    };
    expect(notificationText(rejected, getDictionary("en-US"), "en-US")).toEqual({
      title: "Proof of residency not approved",
      body: "Reason: Blurry photo. Send a new photo to try again.",
    });
  });
});
