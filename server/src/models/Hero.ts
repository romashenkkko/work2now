import type { heroModel } from "../generated/prisma/models/hero";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type HeroProps = heroModel;

export class Hero {
  constructor(public readonly props: HeroProps) {}

  static fromPrisma(row: heroModel): Hero {
    return new Hero(row);
  }

  static async findAll(): Promise<Hero[]> {
    return findAllAs(prisma.hero, (row) => new Hero(row));
  }
}

