import type { reviewsModel } from "../generated/prisma/models/reviews";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type ReviewProps = reviewsModel;

export class Review {
  constructor(public readonly props: ReviewProps) {}

  static fromPrisma(row: reviewsModel): Review {
    return new Review(row);
  }

  static async findAll(): Promise<Review[]> {
    return findAllAs(prisma.reviews, (row) => new Review(row));
  }
}

