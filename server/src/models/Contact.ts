import type { contactModel } from "../generated/prisma/models/contact";
import { prisma } from "../prismaClient";
import { findAllAs } from "./BaseModel";

export type ContactProps = contactModel;

export class Contact {
  constructor(public readonly props: ContactProps) {}

  static fromPrisma(row: contactModel): Contact {
    return new Contact(row);
  }

  static async findAll(): Promise<Contact[]> {
    return findAllAs(prisma.contact, (row) => new Contact(row));
  }
}

