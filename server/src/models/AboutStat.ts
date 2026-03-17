import type { about_statsModel } from "../generated/prisma/models/about_stats";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type AboutStatProps = about_statsModel;

export class AboutStat {
  constructor(public readonly props: AboutStatProps) {}

  static fromPrisma(row: about_statsModel): AboutStat {
    return new AboutStat(row);
  }

  static async findAll(): Promise<AboutStat[]> {
    return findAllAs(prisma.about_stats, (row) => new AboutStat(row));
  }
}

