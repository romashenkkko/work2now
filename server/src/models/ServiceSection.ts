import type { services_sectionModel } from "../generated/prisma/models/services_section";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type ServiceSectionProps = services_sectionModel;

export class ServiceSection {
  constructor(public readonly props: ServiceSectionProps) {}

  static fromPrisma(row: services_sectionModel): ServiceSection {
    return new ServiceSection(row);
  }

  static async findAll(): Promise<ServiceSection[]> {
    return findAllAs(prisma.services_section, (row) => new ServiceSection(row));
  }
}

