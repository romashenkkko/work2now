import type { why_usModel } from "../generated/prisma/models/why_us";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type WhyUsProps = why_usModel;

export class WhyUs {
  constructor(public readonly props: WhyUsProps) {}

  static fromPrisma(row: why_usModel): WhyUs {
    return new WhyUs(row);
  }

  static async findAll(): Promise<WhyUs[]> {
    return findAllAs(prisma.why_us, (row) => new WhyUs(row));
  }
}

