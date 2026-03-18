import type { applicationsModel } from "../generated/prisma/models/applications";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type ApplicationProps = applicationsModel;

export class Application {
  constructor(public readonly props: ApplicationProps) {}

  static fromPrisma(row: applicationsModel): Application {
    return new Application(row);
  }

  static async findAll(): Promise<Application[]> {
    return findAllAs(prisma.applications, (row) => new Application(row));
  }
}

