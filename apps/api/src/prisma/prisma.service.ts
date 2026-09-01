import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '../generated/prisma'
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
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
