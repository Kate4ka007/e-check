import { Injectable } from '@nestjs/common'
import { createHash, randomBytes } from 'node:crypto'
import { RedisService } from '../redis/redis.service'

const LOGIN_WINDOW_SECONDS = 15 * 60
const LOGIN_MAX_ATTEMPTS = 5

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisService) {}

  async assertLoginAllowed(email: string, ip: string): Promise<void> {
    const keys = [`login:email:${email}`, `login:ip:${ip}`]
    for (const key of keys) {
      const attempts = await this.redis.incrementWithExpire(key, LOGIN_WINDOW_SECONDS)
      if (attempts > LOGIN_MAX_ATTEMPTS) {
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
