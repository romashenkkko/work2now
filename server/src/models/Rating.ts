import type { ratingsModel } from "../generated/prisma/models/ratings";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type RatingProps = ratingsModel;

export class Rating {
  constructor(public readonly props: RatingProps) {}

  static fromPrisma(row: ratingsModel): Rating {
    return new Rating(row);
  }

  static async findAll(): Promise<Rating[]> {
    return findAllAs(prisma.ratings, (row) => new Rating(row));
  }
}

