import type { servicesModel } from "../generated/prisma/models/services";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type ServiceProps = servicesModel;

export class Service {
  constructor(public readonly props: ServiceProps) {}

  static fromPrisma(row: servicesModel): Service {
    return new Service(row);
  }

  static async findAll(): Promise<Service[]> {
    return findAllAs(prisma.services, (row) => new Service(row));
  }
}

