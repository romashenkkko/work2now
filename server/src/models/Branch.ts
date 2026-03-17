import type { branchesModel } from "../generated/prisma/models/branches";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type BranchProps = branchesModel;

export class Branch {
  constructor(public readonly props: BranchProps) {}

  static fromPrisma(row: branchesModel): Branch {
    return new Branch(row);
  }

  static async findAll(): Promise<Branch[]> {
    return findAllAs(prisma.branches, (row) => new Branch(row));
  }
}

