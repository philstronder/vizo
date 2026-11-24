import "express";
import type { UserRow } from "../db/users";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      // Set by the residency review routes for the signed-in reviewer.
      reviewer?: UserRow;
    }
  }
}
