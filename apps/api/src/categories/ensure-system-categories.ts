import { CATEGORY_SLUGS } from '@receipt-tracker/contracts'
import type { PrismaClient } from '../generated/prisma'

/** Идемпотентно создаёт системные категории. Без них slug в PATCH не сохраняется. */
export async function ensureSystemCategories(prisma: PrismaClient): Promise<void> {
  for (const [index, slug] of CATEGORY_SLUGS.entries()) {
    const existing = await prisma.category.findFirst({
      where: { slug, userId: null },
    })

    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: {
          nameKey: `category.${slug}`,
          isSystem: true,
          sortOrder: index,
        },
      })
      continue
    }

    await prisma.category.create({
      data: {
        slug,
        nameKey: `category.${slug}`,
        isSystem: true,
        sortOrder: index,
      },
    })
  }
}
