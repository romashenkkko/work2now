import type { raioaneModel } from "../generated/prisma/models/raioane";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type RaionProps = raioaneModel;

export class Raion {
  constructor(public readonly props: RaionProps) {}

  static fromPrisma(row: raioaneModel): Raion {
    return new Raion(row);
  }

  static async findAll(): Promise<Raion[]> {
    return findAllAs(prisma.raioane, (row) => new Raion(row));
  }
}

