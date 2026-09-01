import { Inject, Injectable } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import Redis from 'ioredis'
import { ENV } from '../config/config.module'
import type { Env } from '../config/env.schema'

@Injectable()
export class RateLimitService {
  private readonly redis: Redis

  constructor(@Inject(ENV) private readonly env: Env) {
    this.redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
  }

  async assertLoginAllowed(email: string, ip: string): Promise<void> {
    await this.redis.connect().catch(() => undefined)

    const keys = [`login:email:${email}`, `login:ip:${ip}`]
    for (const key of keys) {
      const attempts = await this.redis.incr(key)
      if (attempts === 1) {
        await this.redis.expire(key, 15 * 60)
      }
      if (attempts > 5) {
        throw new Error('RATE_LIMITED')
      }
    }
  }

  hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex')
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString('base64url')
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
