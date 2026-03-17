import type { usersModel } from "../generated/prisma/models/users";
import { prisma } from "../prismaClient";

/**
 * Domain model for a User.
 * Wraps the raw Prisma users record and exposes
 * convenient getters + domain methods.
 */
export type UserProps = usersModel;

export class User {
  constructor(public readonly props: UserProps) {}

  // Basic getters so you don't have to access props everywhere
  get id(): string {
    return this.props.Id;
  }

  get email(): string {
    return this.props.Email;
  }

  get role(): number {
    return this.props.Role;
  }

  get isActive(): boolean {
    return this.props.IsActive;
  }

  get createdAt(): Date {
    return this.props.CreatedAt;
  }

  // Example domain helpers
  isAdmin(): boolean {
    // Adjust the mapping when you formalize a Role enum
    return this.role === 1;
  }

  isStaff(): boolean {
    return this.role === 2;
  }

  isCustomer(): boolean {
    return this.role === 3;
  }

  /**
   * Recreate a User from a raw Prisma record.
   * Useful when you already called prisma.users.* elsewhere.
   */
  static fromPrisma(record: usersModel): User {
    return new User(record);
  }

  /**
   * Find user by id (GUID in the new schema).
   */
  static async findById(id: string): Promise<User | null> {
    const dbUser = await prisma.users.findUnique({
      where: { Id: id },
    });
    return dbUser ? new User(dbUser) : null;
  }

  /**
   * Find user by email.
   */
  static async findByEmail(email: string): Promise<User | null> {
    const dbUser = await prisma.users.findUnique({
      where: { Email: email },
    });
    return dbUser ? new User(dbUser) : null;
  }

  /**
   * Example: load user together with related profiles (business/employee).
   */
  static async findWithProfiles(id: string): Promise<User | null> {
    const dbUser = await prisma.users.findUnique({
      where: { Id: id },
      include: {
        business_profiles: true,
        employee_profiles: true,
      },
    });
    return dbUser ? new User(dbUser) : null;
  }
}

