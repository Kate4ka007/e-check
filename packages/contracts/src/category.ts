import { z } from 'zod'

/**
 * Закрытый набор системных категорий. Он же передаётся модели распознавания
 * как список допустимых значений, см. DATA_MODEL.md.
 */
export const CATEGORY_SLUGS = [
  'groceries',
  'restaurants',
  'household',
  'transport',
  'health',
  'personal_care',
  'clothing',
  'electronics',
  'entertainment',
  'services',
  'other',
] as const

export const CategorySlugSchema = z.enum(CATEGORY_SLUGS)
export type CategorySlug = z.infer<typeof CategorySlugSchema>

/**
 * Псевдокатегория из ADR-0007: разница между итогом чека и суммой позиций.
 * Модель её никогда не выбирает, аналитика вычисляет.
 */
export const UNCATEGORIZED_SLUG = 'uncategorized' as const

export const CategorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  nameKey: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  isSystem: z.boolean(),
  sortOrder: z.number().int(),
})

export type Category = z.infer<typeof CategorySchema>

/**
 * Системные категории до появления бэкенда.
 *
 * Идентификаторы совпадают со slug'ами: настоящие UUID появятся вместе с базой,
 * а до тех пор совпадение делает фикстуры читаемыми.
 */
export const SYSTEM_CATEGORIES: readonly Category[] = CATEGORY_SLUGS.map((slug, index) => ({
  id: slug,
  slug,
  nameKey: `category.${slug}`,
  icon: null,
  color: null,
  isSystem: true,
  sortOrder: index,
}))
