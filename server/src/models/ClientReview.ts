import type { client_reviewsModel } from "../generated/prisma/models/client_reviews";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type ClientReviewProps = client_reviewsModel;

export class ClientReview {
  constructor(public readonly props: ClientReviewProps) {}

  static fromPrisma(row: client_reviewsModel): ClientReview {
    return new ClientReview(row);
  }

  static async findAll(): Promise<ClientReview[]> {
    return findAllAs(prisma.client_reviews, (row) => new ClientReview(row));
  }
}

