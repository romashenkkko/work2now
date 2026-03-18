import type { employee_profilesModel } from "../generated/prisma/models/employee_profiles";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type EmployeeProfileProps = employee_profilesModel;

export class EmployeeProfile {
  constructor(public readonly props: EmployeeProfileProps) {}

  static fromPrisma(row: employee_profilesModel): EmployeeProfile {
    return new EmployeeProfile(row);
  }

  static async findAll(): Promise<EmployeeProfile[]> {
    return findAllAs(prisma.employee_profiles, (row) => new EmployeeProfile(row));
  }
}

