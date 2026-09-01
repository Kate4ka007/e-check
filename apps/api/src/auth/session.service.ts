import { Inject, Injectable } from '@nestjs/common'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'
import { ENV } from '../config/config.module'
import type { Env } from '../config/env.schema'
import { PrismaService } from '../prisma/prisma.service'
import { RateLimitService } from './rate-limit.service'

@Injectable()
export class SessionService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly tokens: RateLimitService,
  ) {}

  createAccessToken(userId: string, email: string): string {
    return jwt.sign({ sub: userId, email }, this.env.JWT_ACCESS_SECRET, {
      expiresIn: Math.floor(this.env.jwtAccessTtlMs / 1000),
    })
  }

  verifyAccessToken(token: string): { userId: string; email: string } {
    const payload = jwt.verify(token, this.env.JWT_ACCESS_SECRET) as jwt.JwtPayload
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('INVALID_TOKEN')
    }
    return { userId: payload.sub, email: String(payload.email ?? '') }
  }

  async createSession(userId: string, userAgent?: string, ipHash?: string) {
    const refreshToken = this.tokens.generateRefreshToken()
    const tokenHash = this.tokens.hashToken(refreshToken)
    const family = randomUUID()

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        family,
        userAgent,
        ipHash,
        expiresAt: new Date(Date.now() + this.env.refreshTtlMs),
      },
    })

    return refreshToken
  }

  async rotateSession(refreshToken: string, userAgent?: string, ipHash?: string) {
    const tokenHash = this.tokens.hashToken(refreshToken)
    const session = await this.prisma.session.findUnique({ where: { tokenHash } })

    if (!session) {
      throw new Error('AUTH_SESSION_EXPIRED')
    }

    if (session.revokedAt || session.expiresAt <= new Date()) {
      if (session.revokedAt) {
        await this.revokeFamily(session.family)
        throw new Error('AUTH_SESSION_REVOKED')
      }
      throw new Error('AUTH_SESSION_EXPIRED')
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    })

    const nextRefreshToken = this.tokens.generateRefreshToken()
    const nextHash = this.tokens.hashToken(nextRefreshToken)

    await this.prisma.session.create({
      data: {
        userId: session.userId,
        tokenHash: nextHash,
        family: session.family,
        rotatedFrom: session.id,
        userAgent,
        ipHash,
        expiresAt: new Date(Date.now() + this.env.refreshTtlMs),
      },
    })

    return { userId: session.userId, refreshToken: nextRefreshToken }
  }

  async revokeByRefreshToken(refreshToken: string) {
    const tokenHash = this.tokens.hashToken(refreshToken)
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  private async revokeFamily(family: string) {
    await this.prisma.session.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
}
