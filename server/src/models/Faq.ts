import type { faqModel } from "../generated/prisma/models/faq";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type FaqProps = faqModel;

export class Faq {
  constructor(public readonly props: FaqProps) {}

  static fromPrisma(row: faqModel): Faq {
    return new Faq(row);
  }

  static async findAll(): Promise<Faq[]> {
    return findAllAs(prisma.faq, (row) => new Faq(row));
  }
}

