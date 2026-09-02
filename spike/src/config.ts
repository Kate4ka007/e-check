import 'dotenv/config'
import { z } from 'zod'

const csv = (value: string) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

const ConfigSchema = z.object({
  OPENROUTER_API_KEY: z
    .string()
    .min(1, 'Не задан OPENROUTER_API_KEY — скопируйте .env.example в .env'),
  VISION_MODELS: z.string().default('').transform(csv),
  TEXT_MODELS: z.string().default('').transform(csv),
  DATA_COLLECTION: z.enum(['allow', 'deny']).default('allow'),
  IMAGE_MAX_SIDE: z.coerce.number().int().positive().default(2000),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
})

const parsed = ConfigSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Ошибка конфигурации:')
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

export const config = parsed.data

export { OPENROUTER_BASE_URL } from './constants.js'
