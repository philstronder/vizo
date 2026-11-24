import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { condominiumsAdministeredBy, listPendingResidents, reviewResidency, toApiResidencyRequest } from "../db/residency";
import { findUserById, type UserRow } from "../db/users";
import { forbidden, notFound, unauthorized } from "../lib/http-error";
import { canReviewResidency, notifyResidencyReviewed } from "../lib/residency";

// The proof-of-residency review queue. Building admins see and decide on
// their condominiums' requests; platform admins on every building's.
export const residencyRouter = Router();

async function requireReviewer(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.userId) throw unauthorized();
    const user = await findUserById(req.userId);
    if (!user) throw unauthorized();
    if (!user.is_admin && (await condominiumsAdministeredBy(user.id)).length === 0) {
      throw forbidden("residency_reviewers_only");
    }
    req.reviewer = user;
    next();
  } catch (err) {
    next(err);
  }
}

residencyRouter.use(requireReviewer);

residencyRouter.get("/", async (req, res, next) => {
  try {
    const reviewer = req.reviewer!;
    const rows = await listPendingResidents(reviewer.is_admin ? undefined : reviewer.id);
    res.json(rows.filter((r) => r.id !== reviewer.id).map(toApiResidencyRequest));
  } catch (err) {
    next(err);
  }
});

// Requests outside the reviewer's condominiums 404, so they aren't leaked.
async function findReviewableResident(reviewer: UserRow, userId: string): Promise<UserRow> {
  if (userId === reviewer.id) throw forbidden("cannot_review_own_residency");
  const resident = await findUserById(userId);
  if (!resident || !(await canReviewResidency(reviewer, resident))) throw notFound("residency_request_not_found");
  return resident;
}

const userIdParam = z.uuid();

residencyRouter.post("/:userId/approve", async (req, res, next) => {
  try {
    const resident = await findReviewableResident(req.reviewer!, userIdParam.parse(req.params.userId));
    const reviewed = await reviewResidency(resident.id, req.reviewer!.id, { approved: true });
    if (!reviewed) throw notFound("residency_request_not_found");
    await notifyResidencyReviewed(reviewed);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

const rejectSchema = z.object({ reason: z.string().trim().max(500).optional() });

residencyRouter.post("/:userId/reject", async (req, res, next) => {
  try {
    const { reason } = rejectSchema.parse(req.body ?? {});
    const resident = await findReviewableResident(req.reviewer!, userIdParam.parse(req.params.userId));
    const reviewed = await reviewResidency(resident.id, req.reviewer!.id, { approved: false, reason });
    if (!reviewed) throw notFound("residency_request_not_found");
    await notifyResidencyReviewed(reviewed);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
