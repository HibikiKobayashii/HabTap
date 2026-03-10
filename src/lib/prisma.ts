// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// 開発環境で冷蔵庫の扉（コネクション）が増殖するのを防ぐための魔法の記述です
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;