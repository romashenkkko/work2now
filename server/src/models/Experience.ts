import type { experiencesModel } from "../generated/prisma/models/experiences";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type ExperienceProps = experiencesModel;

export class Experience {
  constructor(public readonly props: ExperienceProps) {}

  static fromPrisma(row: experiencesModel): Experience {
    return new Experience(row);
  }

  static async findAll(): Promise<Experience[]> {
    return findAllAs(prisma.experiences, (row) => new Experience(row));
  }
}

