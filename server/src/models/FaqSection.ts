import type { faq_sectionModel } from "../generated/prisma/models/faq_section";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type FaqSectionProps = faq_sectionModel;

export class FaqSection {
  constructor(public readonly props: FaqSectionProps) {}

  static fromPrisma(row: faq_sectionModel): FaqSection {
    return new FaqSection(row);
  }

  static async findAll(): Promise<FaqSection[]> {
    return findAllAs(prisma.faq_section, (row) => new FaqSection(row));
  }
}

