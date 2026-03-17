import type { aboutModel } from "../generated/prisma/models/about";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type AboutProps = aboutModel;

export class About {
  constructor(public readonly props: AboutProps) {}

  static fromPrisma(row: aboutModel): About {
    return new About(row);
  }

  static async findAll(): Promise<About[]> {
    return findAllAs(prisma.about, (row) => new About(row));
  }
}

