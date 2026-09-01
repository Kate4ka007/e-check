import { describe, expect, it } from 'vitest'
import { PrismaClient } from '../generated/prisma'
import { createScopedPrisma, mergeWhere } from './create-scoped-client'

describe('scoped prisma', () => {
  it('requires user context for scoped models', async () => {
    const prisma = createScopedPrisma(new PrismaClient())
    await expect(prisma.merchant.findMany()).rejects.toThrow(/Missing user context/)
    await prisma.$disconnect()
  })

  it('mergeWhere adds filters and combines with existing where', () => {
    expect(mergeWhere({}, { userId: 'user-a' })).toEqual({
      where: { userId: 'user-a' },
    })

    expect(mergeWhere({ where: { name: 'Shop' } }, { userId: 'user-a' })).toEqual({
      where: {
        AND: [{ name: 'Shop' }, { userId: 'user-a' }],
      },
    })
  })
})
