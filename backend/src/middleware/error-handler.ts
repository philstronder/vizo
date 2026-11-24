import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError, errorMessage } from "../lib/http-error";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ code: "not_found", message: `Route not found: ${req.method} ${req.path}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ code: "invalid_request", message: errorMessage("invalid_request"), issues: err.issues });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, message: err.message, ...(err.params && { params: err.params }) });
    return;
  }

  // invalid_text_representation: a malformed UUID in the URL, e.g. a
  // mistyped store link. Nothing can match it, so treat it as not found.
  if (typeof err === "object" && err !== null && (err as { code?: unknown }).code === "22P02") {
    res.status(404).json({ code: "not_found", message: errorMessage("not_found") });
    return;
  }

  console.error(err);
  res.status(500).json({ code: "internal_error", message: errorMessage("internal_error") });
}
