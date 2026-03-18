import type { why_us_itemsModel } from "../generated/prisma/models/why_us_items";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type WhyUsItemProps = why_us_itemsModel;

export class WhyUsItem {
  constructor(public readonly props: WhyUsItemProps) {}

  static fromPrisma(row: why_us_itemsModel): WhyUsItem {
    return new WhyUsItem(row);
  }

  static async findAll(): Promise<WhyUsItem[]> {
    return findAllAs(prisma.why_us_items, (row) => new WhyUsItem(row));
  }
}

