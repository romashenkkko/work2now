import type { admin_usersModel } from "../generated/prisma/models/admin_users";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type AdminUserProps = admin_usersModel;

export class AdminUser {
  constructor(public readonly props: AdminUserProps) {}

  static fromPrisma(row: admin_usersModel): AdminUser {
    return new AdminUser(row);
  }

  static async findAll(): Promise<AdminUser[]> {
    return findAllAs(prisma.admin_users, (row) => new AdminUser(row));
  }
}

