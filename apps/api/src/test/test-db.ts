import { PrismaClient } from '../generated/prisma'
import { ensureSystemCategories as seedSystemCategories } from '../categories/ensure-system-categories'
import Redis from 'ioredis'

let prisma: PrismaClient | null = null

export function getTestPrisma(): PrismaClient {
  prisma ??= new PrismaClient()
  return prisma
}

export async function ensureSystemCategories(): Promise<void> {
  await seedSystemCategories(getTestPrisma())
}

export async function resetTestData(): Promise<void> {
  const client = getTestPrisma()
  await client.processingJob.deleteMany()
  await client.receiptItem.deleteMany()
  await client.receipt.deleteMany()
  await client.idempotencyKey.deleteMany()
  await client.session.deleteMany()
  await client.user.deleteMany()

  const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1 })
  try {
    await redis.flushdb()
  } finally {
    redis.disconnect()
  }
}

/** @deprecated use resetTestData */
export async function resetAuthData(): Promise<void> {
  await resetTestData()
}

export async function disconnectTestPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}
