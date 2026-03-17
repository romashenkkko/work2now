import { Request, Response } from "express";
import { JwtPayload } from "../middleware/auth";
import { ServiceError } from "../services/ServiceError";
import {
  createBranch,
  deleteBranch,
  listBranches,
  updateBranch,
} from "../services/branchesService";

type ReqWithUser = Request & { user?: JwtPayload };

function handleError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  const err = error as Error;
  console.error(fallbackMessage, err);
  res.status(500).json({ error: fallbackMessage.includes("GET") ? "Eroare la încărcarea filialelor." : fallbackMessage.includes("POST") ? "Eroare la crearea filialei." : fallbackMessage.includes("PATCH") ? "Eroare la actualizarea filialei." : "Eroare la ștergerea filialei." });
}

export async function getBranches(req: ReqWithUser, res: Response): Promise<void> {
  try {
    const result = await listBranches(req.user?.userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "GET /api/branches error:");
  }
}

export async function postBranch(req: ReqWithUser, res: Response): Promise<void> {
  try {
    const branch = await createBranch(req.user?.userId, req.body ?? {});
    res.status(201).json(branch);
  } catch (error) {
    handleError(res, error, "POST /api/branches error:");
  }
}

export async function patchBranch(req: ReqWithUser, res: Response): Promise<void> {
  try {
    const branch = await updateBranch(req.user?.userId, req.params.id, req.body ?? {});
    res.json(branch);
  } catch (error) {
    handleError(res, error, "PATCH /api/branches/:id error:");
  }
}

export async function removeBranch(req: ReqWithUser, res: Response): Promise<void> {
  try {
    const result = await deleteBranch(req.user?.userId, req.params.id);
    res.json(result);
  } catch (error) {
    handleError(res, error, "DELETE /api/branches/:id error:");
  }
}

