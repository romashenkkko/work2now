import { Prisma } from "@prisma/client";
import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import { UserRole } from "../enums";

/** E.164: mandatory +, 2–15 digits total, country code cannot start with 0. */
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

function parseE164Phone(raw: string): string {
  const phone = String(raw ?? "").replace(/\s+/g, "").trim();
  if (!E164_PHONE_REGEX.test(phone)) {
    throw new ServiceError("Telefonul trebuie în format E.164 (ex. +37360123456).", 400);
  }
  return phone;
}

export type StaffPayoutAccountDto = Readonly<{
  id: string;
  staffUserId: string;
  isDefault: boolean;
  status: string;
  type: string;
  beneficiaryName: string;
  beneficiaryCountry: string | null;
  iban: string | null;
  bankName: string | null;
  phoneE164: string | null;
  walletProvider: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}>;

function mapRow(row: {
  id: number;
  staff_user_id: string;
  is_default: boolean;
  status: string;
  type: string;
  beneficiary_name: string;
  beneficiary_country: string | null;
  iban: string | null;
  bank_name: string | null;
  phone_e164: string | null;
  wallet_provider: string | null;
  verified_at: Date | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
}): StaffPayoutAccountDto {
  return Object.freeze({
    id: String(row.id),
    staffUserId: row.staff_user_id,
    isDefault: row.is_default,
    status: row.status,
    type: row.type,
    beneficiaryName: row.beneficiary_name,
    beneficiaryCountry: row.beneficiary_country,
    iban: row.iban,
    bankName: row.bank_name,
    phoneE164: row.phone_e164,
    walletProvider: row.wallet_provider,
    verifiedAt: row.verified_at?.toISOString() ?? null,
    rejectedAt: row.rejected_at?.toISOString() ?? null,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

export async function getDefaultVerifiedPayoutAccountId(staffUserId: string): Promise<number | null> {
  const row = await prisma.staff_payout_accounts.findFirst({
    where: { staff_user_id: staffUserId, status: "verified" },
    orderBy: [{ is_default: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function listMyPayoutAccounts(staffUserId: string): Promise<{ accounts: StaffPayoutAccountDto[] }> {
  const rows = await prisma.staff_payout_accounts.findMany({
    where: { staff_user_id: staffUserId },
    orderBy: [{ is_default: "desc" }, { id: "desc" }],
  });
  return { accounts: rows.map(mapRow) };
}

/** Types accepted by the staff self-service upsert API (IBAN bank transfer or phone wallet). */
export type UpsertPayoutAccountInput = Readonly<{
  type: "iban" | "phone";
  beneficiaryName: string;
  beneficiaryCountry?: string | null;
  iban?: string | null;
  bankName?: string | null;
  phoneE164?: string | null;
  walletProvider?: string | null;
}>;

export async function upsertMyPayoutAccount(staffUserId: string, input: UpsertPayoutAccountInput): Promise<StaffPayoutAccountDto> {
  const name = String(input.beneficiaryName ?? "").trim();
  if (name.length < 2) throw new ServiceError("Numele beneficiarului este obligatoriu.", 400);

  if (input.type === "iban") {
    const iban = String(input.iban ?? "").replace(/\s+/g, "").trim().toUpperCase();
    if (iban.length < 15) throw new ServiceError("IBAN invalid.", 400);

    return prisma.$transaction(async (tx) => {
      await tx.staff_payout_accounts.updateMany({
        where: { staff_user_id: staffUserId },
        data: { is_default: false },
      });

      const existing = await tx.staff_payout_accounts.findFirst({
        where: { staff_user_id: staffUserId, type: "iban" },
        orderBy: { id: "asc" },
      });

      const now = new Date();
      if (existing) {
        const updated = await tx.staff_payout_accounts.update({
          where: { id: existing.id },
          data: {
            is_default: true,
            type: "iban",
            beneficiary_name: name,
            beneficiary_country: input.beneficiaryCountry?.trim() || null,
            iban,
            bank_name: input.bankName?.trim() || null,
            phone_e164: null,
            wallet_provider: null,
            status: "submitted",
            verified_at: null,
            rejected_at: null,
            rejection_reason: null,
            updated_at: now,
          },
        });
        return mapRow(updated);
      }

      const created = await tx.staff_payout_accounts.create({
        data: {
          staff_user_id: staffUserId,
          is_default: true,
          status: "submitted",
          type: "iban",
          beneficiary_name: name,
          beneficiary_country: input.beneficiaryCountry?.trim() || null,
          iban,
          bank_name: input.bankName?.trim() || null,
          phone_e164: null,
          wallet_provider: null,
          created_at: now,
          updated_at: now,
        },
      });
      return mapRow(created);
    });
  } else {
    const phone = parseE164Phone(input.phoneE164 ?? "");

    return prisma.$transaction(async (tx) => {
      await tx.staff_payout_accounts.updateMany({
        where: { staff_user_id: staffUserId },
        data: { is_default: false },
      });

      const existing = await tx.staff_payout_accounts.findFirst({
        where: { staff_user_id: staffUserId, type: "phone" },
        orderBy: { id: "asc" },
      });

      const now = new Date();
      if (existing) {
        const updated = await tx.staff_payout_accounts.update({
          where: { id: existing.id },
          data: {
            is_default: true,
            type: "phone",
            beneficiary_name: name,
            beneficiary_country: input.beneficiaryCountry?.trim() || null,
            iban: null,
            bank_name: null,
            phone_e164: phone,
            wallet_provider: input.walletProvider?.trim() || null,
            status: "submitted",
            verified_at: null,
            rejected_at: null,
            rejection_reason: null,
            updated_at: now,
          },
        });
        return mapRow(updated);
      }

      const created = await tx.staff_payout_accounts.create({
        data: {
          staff_user_id: staffUserId,
          is_default: true,
          status: "submitted",
          type: "phone",
          beneficiary_name: name,
          beneficiary_country: input.beneficiaryCountry?.trim() || null,
          iban: null,
          bank_name: null,
          phone_e164: phone,
          wallet_provider: input.walletProvider?.trim() || null,
          created_at: now,
          updated_at: now,
        },
      });
      return mapRow(created);
    });
  }
}

async function requireAdmin(actorUserId: string): Promise<void> {
  const u = await prisma.users.findUnique({ where: { Id: actorUserId }, select: { Role: true } });
  if (!u || u.Role !== UserRole.Admin) throw new ServiceError("Doar administratorii pot realiza această acțiune.", 403);
}

export async function adminVerifyPayoutAccount(actorUserId: string, accountIdRaw: string): Promise<StaffPayoutAccountDto> {
  await requireAdmin(actorUserId);
  const id = Number.parseInt(accountIdRaw, 10);
  if (!Number.isInteger(id) || id < 1) throw new ServiceError("Cont negăsit.", 404);

  const row = await prisma.staff_payout_accounts.update({
    where: { id },
    data: {
      status: "verified",
      verified_at: new Date(),
      rejected_at: null,
      rejection_reason: null,
      verification_provider: "admin",
      verification_reference: actorUserId,
      updated_at: new Date(),
    },
  });
  return mapRow(row);
}

export async function adminRejectPayoutAccount(
  actorUserId: string,
  accountIdRaw: string,
  reason?: string | null
): Promise<StaffPayoutAccountDto> {
  await requireAdmin(actorUserId);
  const id = Number.parseInt(accountIdRaw, 10);
  if (!Number.isInteger(id) || id < 1) throw new ServiceError("Cont negăsit.", 404);

  const row = await prisma.staff_payout_accounts.update({
    where: { id },
    data: {
      status: "rejected",
      rejected_at: new Date(),
      rejection_reason: reason?.trim() || "Respins de administrator.",
      verified_at: null,
      updated_at: new Date(),
    },
  });
  return mapRow(row);
}
