import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import Redis from 'ioredis'
import { ENV } from '../config/config.module'
import type { Env } from '../config/env.schema'

const INCR_WITH_EXPIRE_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly redis: Redis

  constructor(@Inject(ENV) env: Env) {
    this.redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
  }

  async onModuleInit(): Promise<void> {
    await this.redis.connect().catch(() => undefined)
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect()
  }

  async incrementWithExpire(key: string, ttlSeconds: number): Promise<number> {
    const result = await this.redis.eval(INCR_WITH_EXPIRE_SCRIPT, 1, key, ttlSeconds)
    return Number(result)
  }
}
