import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL ??= "file:./dev.db";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

globalForPrisma.prisma = prisma;
