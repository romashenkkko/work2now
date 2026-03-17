import type { hero_trust_itemsModel } from "../generated/prisma/models/hero_trust_items";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type HeroTrustItemProps = hero_trust_itemsModel;

export class HeroTrustItem {
  constructor(public readonly props: HeroTrustItemProps) {}

  static fromPrisma(row: hero_trust_itemsModel): HeroTrustItem {
    return new HeroTrustItem(row);
  }

  static async findAll(): Promise<HeroTrustItem[]> {
    return findAllAs(prisma.hero_trust_items, (row) => new HeroTrustItem(row));
  }
}

