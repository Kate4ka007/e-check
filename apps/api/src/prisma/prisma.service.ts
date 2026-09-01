import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '../generated/prisma'
import { ensureSystemCategories } from '../categories/ensure-system-categories'
import { createScopedPrisma, type ScopedPrismaClient } from './create-scoped-client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  readonly scoped: ScopedPrismaClient

  constructor() {
    super()
    this.scoped = createScopedPrisma(this)
  }

  async onModuleInit() {
    await this.$connect()
    await ensureSystemCategories(this)
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
