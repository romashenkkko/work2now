import type { testimonials_sectionModel } from "../generated/prisma/models/testimonials_section";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type TestimonialSectionProps = testimonials_sectionModel;

export class TestimonialSection {
  constructor(public readonly props: TestimonialSectionProps) {}

  static fromPrisma(row: testimonials_sectionModel): TestimonialSection {
    return new TestimonialSection(row);
  }

  static async findAll(): Promise<TestimonialSection[]> {
    return findAllAs(prisma.testimonials_section, (row) => new TestimonialSection(row));
  }
}

