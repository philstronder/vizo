import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./lib/env";
import { attachUser } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth.routes";
import { listingsRouter } from "./routes/listings.routes";
import { ordersRouter } from "./routes/orders.routes";
import { notificationsRouter } from "./routes/notifications.routes";
import { storesRouter } from "./routes/stores.routes";
import { adminsRouter } from "./routes/admins.routes";
import { condominiumsRouter } from "./routes/condominiums.routes";
import { cepRouter } from "./routes/cep.routes";
import { walletRouter } from "./routes/wallet.routes";

export const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
// Listing photos are carried as base64 data URLs until real object storage
// (S3) is wired up — see db/schema.sql — so the default 100kb JSON limit
// isn't enough for a handful of compressed images.
app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());
app.use(attachUser);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/listings", listingsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/stores", storesRouter);
app.use("/api/admins", adminsRouter);
app.use("/api/condominiums", condominiumsRouter);
app.use("/api/cep", cepRouter);
app.use("/api/wallet", walletRouter);

app.use(notFoundHandler);
app.use(errorHandler);
