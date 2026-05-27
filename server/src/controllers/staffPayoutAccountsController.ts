import type { Request, Response } from "express";
import type { JwtPayload } from "../middleware/auth";
import { prisma } from "../prismaClient";
import { UserRole } from "../enums";
import { ServiceError } from "../services/ServiceError";
import { listMyPayoutAccounts, upsertMyPayoutAccount, type UpsertPayoutAccountInput } from "../services/staffPayoutAccountService";

type ReqWithUser = Request & { user?: JwtPayload };

async function requireStaffUserId(req: ReqWithUser): Promise<string> {
  const userId = req.user?.userId;
  if (!userId) throw new ServiceError("Unauthorized", 401);
  const u = await prisma.users.findUnique({
    where: { Id: userId },
    select: { Role: true },
  });
  if (!u || u.Role !== UserRole.Employee) {
    throw new ServiceError("Doar conturile staff pot accesa plățile.", 403);
  }
  return userId;
}

function handleError(res: Response, error: unknown, logLabel: string, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(logLabel, error);
  res.status(500).json({ error: fallbackMessage });
}

export async function listMyPayoutAccountsController(req: ReqWithUser, res: Response): Promise<void> {
  try {
    const userId = await requireStaffUserId(req);
    const result = await listMyPayoutAccounts(userId);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, "GET /api/payout-accounts error:", "Eroare la citirea conturilor de plată.");
  }
}

export async function upsertMyPayoutAccountController(req: ReqWithUser, res: Response): Promise<void> {
  try {
    const userId = await requireStaffUserId(req);
    const body = req.body as Record<string, unknown>;
    const type = String(body.type ?? "iban").trim().toLowerCase() as UpsertPayoutAccountInput["type"];
    if (type !== "iban" && type !== "phone") {
      res.status(400).json({ error: "Tip cont invalid (iban sau phone)." });
      return;
    }
    const input: UpsertPayoutAccountInput = {
      type,
      beneficiaryName: String(body.beneficiaryName ?? body.beneficiary_name ?? ""),
      beneficiaryCountry: body.beneficiaryCountry != null ? String(body.beneficiaryCountry) : body.beneficiary_country != null ? String(body.beneficiary_country) : null,
      iban: body.iban != null ? String(body.iban) : null,
      bankName: body.bankName != null ? String(body.bankName) : body.bank_name != null ? String(body.bank_name) : null,
      phoneE164: body.phoneE164 != null ? String(body.phoneE164) : body.phone_e164 != null ? String(body.phone_e164) : null,
      walletProvider: body.walletProvider != null ? String(body.walletProvider) : body.wallet_provider != null ? String(body.wallet_provider) : null,
    };
    const account = await upsertMyPayoutAccount(userId, input);
    res.status(200).json({ ok: true, account });
  } catch (error) {
    handleError(res, error, "POST /api/payout-accounts error:", "Eroare la salvarea contului de plată.");
  }
}
