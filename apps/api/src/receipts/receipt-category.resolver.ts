import { CATEGORY_SLUGS } from '@receipt-tracker/contracts'
import type { PrismaClient } from '../generated/prisma'
import { ensureSystemCategories } from '../categories/ensure-system-categories'

const SLUG_SET = new Set<string>(CATEGORY_SLUGS)

export class ReceiptCategoryResolver {
  private slugToId = new Map<string, string>()
  private idToSlug = new Map<string, string>()

  static async create(prisma: PrismaClient): Promise<ReceiptCategoryResolver> {
    const resolver = new ReceiptCategoryResolver()
    await resolver.load(prisma)
    return resolver
  }

  private async load(prisma: PrismaClient): Promise<void> {
    await ensureSystemCategories(prisma)

    const categories = await prisma.category.findMany({
      where: { userId: null, isSystem: true },
      select: { id: true, slug: true },
    })

    for (const category of categories) {
      this.slugToId.set(category.slug, category.id)
      this.idToSlug.set(category.id, category.slug)
    }
  }

  /** Принимает slug или UUID, возвращает UUID для базы. */
  resolveDbId(categoryId: string | null | undefined): string | null {
    if (!categoryId) return null
    if (this.slugToId.has(categoryId)) return this.slugToId.get(categoryId)!
    if (this.idToSlug.has(categoryId)) return categoryId
    if (SLUG_SET.has(categoryId)) return this.slugToId.get(categoryId) ?? null
    return null
  }

  /** Для API: системные категории отдаём slug'ом — так же, как во фикстурах. */
  toApiId(categoryId: string | null | undefined): string | null {
    if (!categoryId) return null
    return this.idToSlug.get(categoryId) ?? categoryId
  }
}
