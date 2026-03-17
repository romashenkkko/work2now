import type { settingsModel } from "../generated/prisma/models/settings";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type SettingProps = settingsModel;

export class Setting {
  constructor(public readonly props: SettingProps) {}

  static fromPrisma(row: settingsModel): Setting {
    return new Setting(row);
  }

  static async findAll(): Promise<Setting[]> {
    return findAllAs(prisma.settings, (row) => new Setting(row));
  }
}

