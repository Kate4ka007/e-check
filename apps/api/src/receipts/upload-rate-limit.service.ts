import { Inject, Injectable } from '@nestjs/common'
import { ApiError } from '@receipt-tracker/contracts'
import Redis from 'ioredis'
import { ENV } from '../config/config.module'
import type { Env } from '../config/env.schema'

@Injectable()
export class UploadRateLimitService {
  private readonly redis: Redis

  constructor(@Inject(ENV) private readonly env: Env) {
    this.redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
  }

  async assertAllowed(userId: string): Promise<void> {
    await this.redis.connect().catch(() => undefined)

    const key = `upload:user:${userId}`
    const attempts = await this.redis.incr(key)
    if (attempts === 1) {
      await this.redis.expire(key, 60 * 60)
    }
    if (attempts > this.env.UPLOAD_RATE_PER_HOUR) {
      throw new ApiError('RATE_LIMIT_EXCEEDED', 'Upload rate limit exceeded', 429)
    }
  }
}
