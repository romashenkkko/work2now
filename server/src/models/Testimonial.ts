import type { testimonialsModel } from "../generated/prisma/models/testimonials";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type TestimonialProps = testimonialsModel;

export class Testimonial {
  constructor(public readonly props: TestimonialProps) {}

  static fromPrisma(row: testimonialsModel): Testimonial {
    return new Testimonial(row);
  }

  static async findAll(): Promise<Testimonial[]> {
    return findAllAs(prisma.testimonials, (row) => new Testimonial(row));
  }
}

