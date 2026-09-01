import { z } from 'zod'

export const RegisterRequestSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(10),
  timezone: z.string().min(1),
  baseCurrency: z
    .string()
    .length(3)
    .transform((value) => value.toUpperCase()),
})

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>

export const LoginRequestSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
})

export type LoginRequest = z.infer<typeof LoginRequestSchema>

export const UserProfileSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().nullable(),
  timezone: z.string(),
  baseCurrency: z.string().length(3),
  locale: z.string(),
  emailVerified: z.boolean(),
})

export type UserProfile = z.infer<typeof UserProfileSchema>
