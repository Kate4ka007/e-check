import { z } from 'zod'

function parseDuration(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim())
  if (!match) throw new Error(`Invalid duration: ${value}`)

  const amount = Number(match[1])
  switch (match[2]) {
    case 'ms':
      return amount
    case 's':
      return amount * 1000
    case 'm':
      return amount * 60_000
    case 'h':
      return amount * 3_600_000
    case 'd':
      return amount * 86_400_000
    default:
      throw new Error(`Invalid duration unit: ${match[2]}`)
  }
}

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_URL: z.url(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL: z.string().default('30d'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),

  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('true')
    .transform((value) => value === 'true'),

  EXTRACTOR_KIND: z.enum(['mock', 'vision', 'two-stage']).default('mock'),
  EXTRACTOR_BASE_URL: z.url(),
  EXTRACTOR_API_KEY: z.string().default(''),
  EXTRACTOR_MODELS: z.string().default(''),
  EXTRACTOR_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  EXTRACTOR_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  EXTRACTOR_DATA_COLLECTION: z.enum(['allow', 'deny']).default('allow'),

  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(15_728_640),
  UPLOAD_RATE_PER_HOUR: z.coerce.number().int().positive().default(30),

  REGISTRATION_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value === 'true'),
  SENTRY_DSN: z.string().default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
})

export type Env = z.infer<typeof EnvSchema> & {
  jwtAccessTtlMs: number
  refreshTtlMs: number
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.parse(source)
  return {
    ...parsed,
    jwtAccessTtlMs: parseDuration(parsed.JWT_ACCESS_TTL),
    refreshTtlMs: parseDuration(parsed.REFRESH_TTL),
  }
}
