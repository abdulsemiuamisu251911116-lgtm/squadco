import "server-only";

import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function isRetryablePrismaError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code === "P1017"
    : error instanceof Prisma.PrismaClientUnknownRequestError;
}

export async function withPrismaReconnectRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryablePrismaError(error)) {
      throw error;
    }

    await prisma.$disconnect().catch(() => undefined);
    return operation();
  }
}
