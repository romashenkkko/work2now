import type { process_stepsModel } from "../generated/prisma/models/process_steps";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type ProcessStepProps = process_stepsModel;

export class ProcessStep {
  constructor(public readonly props: ProcessStepProps) {}

  static fromPrisma(row: process_stepsModel): ProcessStep {
    return new ProcessStep(row);
  }

  static async findAll(): Promise<ProcessStep[]> {
    return findAllAs(prisma.process_steps, (row) => new ProcessStep(row));
  }
}

