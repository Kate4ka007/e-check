import { Injectable } from '@nestjs/common'
import { ApiError, type ReceiptUploadResponse } from '@receipt-tracker/contracts'
import { PrismaService } from '../prisma/prisma.service'

const TTL_MS = 24 * 60 * 60 * 1000

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async read(
    key: string,
    userId: string,
    endpoint: string,
  ): Promise<{ statusCode: number; body: ReceiptUploadResponse } | null> {
    const record = await this.prisma.idempotencyKey.findUnique({ where: { key } })
    if (!record || record.expiresAt <= new Date()) return null
    if (record.userId !== userId || record.endpoint !== endpoint) {
      throw new ApiError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key reused', 409)
    }
    return {
      statusCode: record.statusCode,
      body: record.responseBody as ReceiptUploadResponse,
    }
  }

  async assertNotReused(key: string, userId: string, endpoint: string, requestHash: string): Promise<void> {
    const record = await this.prisma.idempotencyKey.findUnique({ where: { key } })
    if (!record || record.expiresAt <= new Date()) return
    if (record.userId !== userId || record.endpoint !== endpoint) {
      throw new ApiError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key reused', 409)
    }
    if (record.requestHash !== requestHash) {
      throw new ApiError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key reused with different payload', 409)
    }
  }

  async save(
    key: string,
    userId: string,
    endpoint: string,
    requestHash: string,
    statusCode: number,
    body: ReceiptUploadResponse,
  ): Promise<void> {
    await this.prisma.idempotencyKey.create({
      data: {
        key,
        userId,
        endpoint,
        requestHash,
        statusCode,
        responseBody: body,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    })
  }
}
