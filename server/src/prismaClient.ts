import "./env";
import "./env";
import { PrismaClient } from "@prisma/client";

// Single shared PrismaClient instance for the whole API.
// Import this wherever you need to talk to the database.
export const prisma = new PrismaClient();

