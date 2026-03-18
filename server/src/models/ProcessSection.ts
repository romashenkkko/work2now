import type { process_sectionModel } from "../generated/prisma/models/process_section";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type ProcessSectionProps = process_sectionModel;

export class ProcessSection {
  constructor(public readonly props: ProcessSectionProps) {}

  static fromPrisma(row: process_sectionModel): ProcessSection {
    return new ProcessSection(row);
  }

  static async findAll(): Promise<ProcessSection[]> {
    return findAllAs(prisma.process_section, (row) => new ProcessSection(row));
  }
}

