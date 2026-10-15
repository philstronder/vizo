import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ message: "Invalid request", issues: err.issues });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  // invalid_text_representation: a malformed UUID in the URL, e.g. a
  // mistyped store link. Nothing can match it, so treat it as not found.
  if (typeof err === "object" && err !== null && (err as { code?: unknown }).code === "22P02") {
    res.status(404).json({ message: "Not found" });
    return;
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}
