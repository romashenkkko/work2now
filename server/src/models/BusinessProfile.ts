import type { business_profilesModel } from "../generated/prisma/models/business_profiles";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type BusinessProfileProps = business_profilesModel;

export class BusinessProfile {
  constructor(public readonly props: BusinessProfileProps) {}

  static fromPrisma(row: business_profilesModel): BusinessProfile {
    return new BusinessProfile(row);
  }

  static async findAll(): Promise<BusinessProfile[]> {
    return findAllAs(prisma.business_profiles, (row) => new BusinessProfile(row));
  }
}

