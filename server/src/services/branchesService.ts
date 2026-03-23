import { randomUUID } from "crypto";
import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";

export type BranchDto = {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  phoneNumber: string;
  isActive: boolean;
  createdAt: string;
};

type BranchPayload = {
  name?: unknown;
  address?: unknown;
  city?: unknown;
  country?: unknown;
  phoneNumber?: unknown;
  isActive?: unknown;
};

function requireUserId(userId?: string): string {
  if (!userId) {
    throw new ServiceError("Unauthorized", 401);
  }
  return userId;
}

function mapBranchRow(branch: {
  Id: string;
  Name: string;
  Address: string;
  City: string;
  Country: string;
  PhoneNumber: string;
  IsActive: boolean;
  CreatedAt: Date;
}): BranchDto {
  return {
    id: branch.Id,
    name: branch.Name,
    address: branch.Address,
    city: branch.City,
    country: branch.Country,
    phoneNumber: branch.PhoneNumber,
    isActive: branch.IsActive,
    createdAt: branch.CreatedAt instanceof Date ? branch.CreatedAt.toISOString() : String(branch.CreatedAt),
  };
}

async function getBusinessProfileId(userId: string): Promise<string | null> {
  const businessProfile = await prisma.business_profiles.findUnique({
    where: { UserId: userId },
    select: { Id: true },
  });
  return businessProfile?.Id ?? null;
}

export async function listBranches(userId?: string): Promise<{ branches: BranchDto[] }> {
  const resolvedUserId = requireUserId(userId);
  const businessProfileId = await getBusinessProfileId(resolvedUserId);

  if (!businessProfileId) {
    return { branches: [] };
  }

  const branches = await prisma.branches.findMany({
    where: { BusinessProfileId: businessProfileId },
    orderBy: { CreatedAt: "asc" },
    select: {
      Id: true,
      Name: true,
      Address: true,
      City: true,
      Country: true,
      PhoneNumber: true,
      IsActive: true,
      CreatedAt: true,
    },
  });

  return {
    branches: branches.map(mapBranchRow),
  };
}

export async function createBranch(userId?: string, payload: BranchPayload = {}): Promise<BranchDto> {
  const resolvedUserId = requireUserId(userId);
  const { name, address, city, country, phoneNumber } = payload;

  if (!name || typeof name !== "string" || !name.trim()) {
    throw new ServiceError("Numele filialei este obligatoriu.", 400);
  }
  if (!address || typeof address !== "string" || !address.trim()) {
    throw new ServiceError("Adresa este obligatorie.", 400);
  }
  if (!city || typeof city !== "string" || !city.trim()) {
    throw new ServiceError("Orașul este obligatoriu.", 400);
  }
  if (!phoneNumber || typeof phoneNumber !== "string" || !phoneNumber.trim()) {
    throw new ServiceError("Numărul de telefon este obligatoriu.", 400);
  }

  const businessProfileId = await getBusinessProfileId(resolvedUserId);
  if (!businessProfileId) {
    throw new ServiceError("Nu aveți profil de business. Doar utilizatorii cu profil de business pot crea filiale.", 403);
  }

  const branchId = randomUUID();
  const normalizedCountry = (country && typeof country === "string" ? country.trim() : "Moldova") || "Moldova";

  const created = await prisma.branches.create({
    data: {
      Id: branchId,
      BusinessProfileId: businessProfileId,
      Name: name.trim(),
      Address: address.trim(),
      City: city.trim(),
      Country: normalizedCountry,
      PhoneNumber: phoneNumber.trim(),
      IsActive: true,
      CreatedAt: new Date(),
      ContactPersonName: "",
      ContactPersonSurname: "",
    },
    select: {
      Id: true,
      Name: true,
      Address: true,
      City: true,
      Country: true,
      PhoneNumber: true,
      IsActive: true,
      CreatedAt: true,
    },
  });

  return mapBranchRow(created);
}

export async function updateBranch(userId: string | undefined, branchId: string, payload: BranchPayload = {}): Promise<BranchDto | { message: string }> {
  const resolvedUserId = requireUserId(userId);
  const { name, address, city, country, phoneNumber, isActive } = payload;
  const businessProfileId = await getBusinessProfileId(resolvedUserId);
  if (!businessProfileId) {
    throw new ServiceError("Filiala nu a fost găsită sau nu aveți permisiunea să o modificați.", 404);
  }

  const existingBranch = await prisma.branches.findFirst({
    where: {
      Id: branchId,
      BusinessProfileId: businessProfileId,
    },
    select: { Id: true },
  });

  if (!existingBranch) {
    throw new ServiceError("Filiala nu a fost găsită sau nu aveți permisiunea să o modificați.", 404);
  }

  const data: {
    Name?: string;
    Address?: string;
    City?: string;
    Country?: string;
    PhoneNumber?: string;
    IsActive?: boolean;
  } = {};

  if (name !== undefined && typeof name === "string") {
    if (!name.trim()) throw new ServiceError("Numele filialei nu poate fi gol.", 400);
    data.Name = name.trim();
  }
  if (address !== undefined && typeof address === "string") {
    if (!address.trim()) throw new ServiceError("Adresa nu poate fi goală.", 400);
    data.Address = address.trim();
  }
  if (city !== undefined && typeof city === "string") {
    if (!city.trim()) throw new ServiceError("Orașul nu poate fi gol.", 400);
    data.City = city.trim();
  }
  if (country !== undefined && typeof country === "string") {
    data.Country = country.trim() || "Moldova";
  }
  if (phoneNumber !== undefined && typeof phoneNumber === "string") {
    if (!phoneNumber.trim()) throw new ServiceError("Numărul de telefon nu poate fi gol.", 400);
    data.PhoneNumber = phoneNumber.trim();
  }
  if (isActive !== undefined) {
    data.IsActive = Boolean(isActive);
  }

  if (Object.keys(data).length === 0) {
    throw new ServiceError("Nu ați specificat câmpuri de actualizat.", 400);
  }

  const branch = await prisma.branches.update({
    where: { Id: branchId },
    data,
    select: {
      Id: true,
      Name: true,
      Address: true,
      City: true,
      Country: true,
      PhoneNumber: true,
      IsActive: true,
      CreatedAt: true,
    },
  });

  return branch ? mapBranchRow(branch) : { message: "Filiala a fost actualizată." };
}

export async function deleteBranch(userId: string | undefined, branchId: string): Promise<{ ok: true; message: string }> {
  const resolvedUserId = requireUserId(userId);
  const businessProfileId = await getBusinessProfileId(resolvedUserId);
  if (!businessProfileId) {
    throw new ServiceError("Filiala nu a fost găsită sau nu aveți permisiunea să o ștergeți.", 404);
  }

  const existingBranch = await prisma.branches.findFirst({
    where: {
      Id: branchId,
      BusinessProfileId: businessProfileId,
    },
    select: { Id: true },
  });

  if (!existingBranch) {
    throw new ServiceError("Filiala nu a fost găsită sau nu aveți permisiunea să o ștergeți.", 404);
  }

  await prisma.branches.delete({ where: { Id: branchId } });
  return { ok: true, message: "Filiala a fost ștearsă cu succes." };
}

