import { PrismaClient } from '../generated/prisma'
import { CATEGORY_SLUGS } from '@receipt-tracker/contracts'
import Redis from 'ioredis'

let prisma: PrismaClient | null = null

export function getTestPrisma(): PrismaClient {
  prisma ??= new PrismaClient()
  return prisma
}

export async function ensureSystemCategories(): Promise<void> {
  const client = getTestPrisma()
  for (const [index, slug] of CATEGORY_SLUGS.entries()) {
    const existing = await client.category.findFirst({
      where: { slug, userId: null },
    })

    if (existing) {
      await client.category.update({
        where: { id: existing.id },
        data: {
          nameKey: `category.${slug}`,
          isSystem: true,
          sortOrder: index,
        },
      })
    } else {
      await client.category.create({
        data: {
          slug,
          nameKey: `category.${slug}`,
          isSystem: true,
          sortOrder: index,
        },
      })
    }
  }
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
