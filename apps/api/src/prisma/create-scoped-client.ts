import type { Prisma, PrismaClient } from '../generated/prisma'
import { getUserId } from '../common/request-context'

const USER_SCOPED_MODELS = new Set<Prisma.ModelName>(['Merchant', 'Receipt'])

const SOFT_DELETE_MODELS = new Set<Prisma.ModelName>(['Merchant', 'Receipt'])

type QueryArgs = Record<string, unknown>

export function mergeWhere(args: QueryArgs, extra: Record<string, unknown>): QueryArgs {
  const current = args.where
  if (!current || typeof current !== 'object') {
    return { ...args, where: extra }
  }

  return {
    ...args,
    where: {
      AND: [current, extra],
    },
  }
}

export function createScopedPrisma(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, args, query }) {
          let nextArgs = args as QueryArgs

          if (USER_SCOPED_MODELS.has(model)) {
            const userId = getUserId()
            if (!userId) {
              throw new Error(`Missing user context for scoped model ${model}`)
            }
            nextArgs = mergeWhere(nextArgs, { userId })
          }

          if (SOFT_DELETE_MODELS.has(model)) {
            nextArgs = mergeWhere(nextArgs, { deletedAt: null })
          }

          return query(nextArgs)
        },
      },
    },
  })
}

export type ScopedPrismaClient = ReturnType<typeof createScopedPrisma>
