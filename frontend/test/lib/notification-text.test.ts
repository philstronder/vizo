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
});
