import type { mediaModel } from "../generated/prisma/models/media";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type MediaProps = mediaModel;

export class Media {
  constructor(public readonly props: MediaProps) {}

  static fromPrisma(row: mediaModel): Media {
    return new Media(row);
  }

  static async findAll(): Promise<Media[]> {
    return findAllAs(prisma.media, (row) => new Media(row));
  }
}

