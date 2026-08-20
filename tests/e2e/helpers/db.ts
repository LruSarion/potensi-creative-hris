import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";

/**
 * Standalone PrismaClient for E2E DB assertions.
 * Connects to the same DATABASE_URL the app uses.
 */
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Singleton to avoid connection exhaustion across tests.
const globalForPrisma = globalThis as unknown as {
  e2ePrisma: PrismaClient | undefined;
};

export const db = globalForPrisma.e2ePrisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.e2ePrisma = db;
}
