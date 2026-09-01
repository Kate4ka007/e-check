import { Inject, Injectable } from '@nestjs/common'
import { ApiError, type UserProfile } from '@receipt-tracker/contracts'
import type { User } from '../generated/prisma'
import { ENV } from '../config/config.module'
import type { Env } from '../config/env.schema'
import { PrismaService } from '../prisma/prisma.service'
import { PasswordService } from './password.service'
import { RateLimitService } from './rate-limit.service'
import { SessionService } from './session.service'

@Injectable()
export class AuthService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly rateLimit: RateLimitService,
  ) {}

  toProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      timezone: user.timezone,
      baseCurrency: user.baseCurrency,
      locale: user.locale,
      emailVerified: user.emailVerifiedAt !== null,
    }
  }

  async register(input: {
    email: string
    password: string
    timezone: string
    baseCurrency: string
  }) {
    if (!this.env.REGISTRATION_ENABLED) {
      throw new ApiError('AUTH_REGISTRATION_DISABLED', 'Registration is disabled', 403)
    }

    this.passwords.assertStrongEnough(input.password)
    await this.passwords.assertNotPwned(input.password)

    const existing = await this.prisma.user.findUnique({ where: { email: input.email } })
    if (existing) {
      throw new ApiError('AUTH_EMAIL_TAKEN', 'Email is already registered', 409)
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await this.passwords.hashPassword(input.password),
        timezone: input.timezone,
        baseCurrency: input.baseCurrency,
        locale: 'ru',
      },
    })

    return user
  }

  async login(email: string, password: string, ip: string) {
    try {
      await this.rateLimit.assertLoginAllowed(email, ip)
    } catch {
      throw new ApiError('AUTH_INVALID_CREDENTIALS', 'Invalid credentials', 401)
    }

    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    })

    if (!user || !(await this.passwords.verifyPassword(password, user.passwordHash))) {
      throw new ApiError('AUTH_INVALID_CREDENTIALS', 'Invalid credentials', 401)
    }

    return user
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    })

    if (!user) {
      throw new ApiError('AUTH_UNAUTHENTICATED', 'Authentication required', 401)
    }

    return user
  }

  async issueTokens(user: User, userAgent?: string, ip?: string) {
    const accessToken = this.sessions.createAccessToken(user.id, user.email)
    const refreshToken = await this.sessions.createSession(
      user.id,
      userAgent,
      ip ? this.rateLimit.hashIp(ip) : undefined,
    )

    return { accessToken, refreshToken, profile: this.toProfile(user) }
  }

  async refresh(refreshToken: string, userAgent?: string, ip?: string) {
    try {
      const rotated = await this.sessions.rotateSession(
        refreshToken,
        userAgent,
        ip ? this.rateLimit.hashIp(ip) : undefined,
      )
      const user = await this.getUserById(rotated.userId)
      const accessToken = this.sessions.createAccessToken(user.id, user.email)
      return {
        accessToken,
        refreshToken: rotated.refreshToken,
        profile: this.toProfile(user),
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'AUTH_SESSION_REVOKED') {
          throw new ApiError('AUTH_SESSION_REVOKED', 'Session revoked', 401)
        }
        if (error.message === 'AUTH_SESSION_EXPIRED') {
          throw new ApiError('AUTH_SESSION_EXPIRED', 'Session expired', 401)
        }
      }
      throw error
    }
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await this.sessions.revokeByRefreshToken(refreshToken)
    }
  }
}
