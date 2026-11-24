import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { createNotification } from "../../src/db/notifications";
import { pool } from "../../src/db/pool";
import { as, insertUser, notificationsOf } from "./factories";

let ana: string;
let bruno: string;

beforeEach(async () => {
  ana = await insertUser({ name: "Ana" });
  bruno = await insertUser({ name: "Bruno" });
  await createNotification({ userId: ana, type: "sold", title: "Bike sold!", body: "Nice", href: "/orders" });
  await pool.query("UPDATE notifications SET created_at = now() - interval '1 minute'");
  await createNotification({ userId: ana, type: "message", title: "New message", body: "Hi" });
  await createNotification({ userId: bruno, type: "sold", title: "Lamp sold!", body: "Nice" });
});

const list = (userId: string) => request(app).get("/api/notifications").set("Cookie", as(userId));

describe("notifications", () => {
  it("requires a session", async () => {
    expect((await request(app).get("/api/notifications")).status).toBe(401);
    expect((await request(app).patch("/api/notifications/read-all")).status).toBe(401);
  });

  it("lists only the signed-in user's notifications, newest first", async () => {
    const res = await list(ana);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({ title: "New message", read: false }),
      expect.objectContaining({ title: "Bike sold!", read: false, href: "/orders" }),
    ]);
    expect(res.body[0]).not.toHaveProperty("href");
  });

  it("marks one as read", async () => {
    const [newest] = (await list(ana)).body;
    expect((await request(app).patch(`/api/notifications/${newest.id}/read`).set("Cookie", as(ana))).status).toBe(204);
    expect((await notificationsOf(ana)).map((n) => n.read)).toEqual([false, true]);
  });

  it("can't touch someone else's notification", async () => {
    const [notification] = (await list(ana)).body;
    const res = await request(app).patch(`/api/notifications/${notification.id}/read`).set("Cookie", as(bruno));
    expect(res.status).toBe(404);
    expect((await notificationsOf(ana)).every((n) => !n.read)).toBe(true);
  });

  it("marks all of the user's notifications read, and nobody else's", async () => {
    expect((await request(app).patch("/api/notifications/read-all").set("Cookie", as(ana))).status).toBe(204);
    expect((await notificationsOf(ana)).every((n) => n.read)).toBe(true);
    expect((await notificationsOf(bruno)).every((n) => !n.read)).toBe(true);
  });
});
