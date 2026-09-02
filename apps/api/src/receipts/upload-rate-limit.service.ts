import { Inject, Injectable } from '@nestjs/common'
import { ApiError } from '@receipt-tracker/contracts'
import { ENV } from '../config/config.module'
import type { Env } from '../config/env.schema'
import { RedisService } from '../redis/redis.service'

const UPLOAD_WINDOW_SECONDS = 60 * 60

@Injectable()
export class UploadRateLimitService {
  constructor(
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async assertAllowed(userId: string): Promise<void> {
    const attempts = await this.redis.incrementWithExpire(
      `upload:user:${userId}`,
      UPLOAD_WINDOW_SECONDS,
    )
    if (attempts > this.env.UPLOAD_RATE_PER_HOUR) {
      throw new ApiError('RATE_LIMIT_EXCEEDED', 'Upload rate limit exceeded', 429)
    }
  }
}
