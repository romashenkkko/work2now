import type { job_categoriesModel } from "../generated/prisma/models/job_categories";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type JobCategoryProps = job_categoriesModel;

export class JobCategory {
  constructor(public readonly props: JobCategoryProps) {}

  static fromPrisma(row: job_categoriesModel): JobCategory {
    return new JobCategory(row);
  }

  static async findAll(): Promise<JobCategory[]> {
    return findAllAs(prisma.job_categories, (row) => new JobCategory(row));
  }
}

