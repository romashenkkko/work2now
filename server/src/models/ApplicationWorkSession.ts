import type { application_work_sessionsModel } from "../generated/prisma/models/application_work_sessions";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type ApplicationWorkSessionProps = application_work_sessionsModel;

export class ApplicationWorkSession {
  constructor(public readonly props: ApplicationWorkSessionProps) {}

  static fromPrisma(row: application_work_sessionsModel): ApplicationWorkSession {
    return new ApplicationWorkSession(row);
  }

  static async findAll(): Promise<ApplicationWorkSession[]> {
    return findAllAs(prisma.application_work_sessions, (row) => new ApplicationWorkSession(row));
  }
}

