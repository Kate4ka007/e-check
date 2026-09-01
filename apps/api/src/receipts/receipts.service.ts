import { Inject, Injectable } from '@nestjs/common'
import {
  ApiError,
  EntryModeSchema,
  type EntryMode,
  type ProcessingStatus,
  type ReceiptUploadResponse,
} from '@receipt-tracker/contracts'
import { randomUUID } from 'node:crypto'
import { getRequestId } from '../common/request-context'
import { ENV } from '../config/config.module'
import type { Env } from '../config/env.schema'
import { PrismaService } from '../prisma/prisma.service'
import { StorageService } from '../storage/storage.service'
import { hashBuffer, hashRequest } from './file-signature'
import { IdempotencyService } from './idempotency.service'
import { ImageProcessorService } from './image-processor.service'
import { ReceiptQueueService } from './receipt-queue.service'
import { UploadRateLimitService } from './upload-rate-limit.service'

const UPLOAD_ENDPOINT = 'POST /receipts/upload'

@Injectable()
export class ReceiptsService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly images: ImageProcessorService,
    private readonly idempotency: IdempotencyService,
    private readonly uploadRateLimit: UploadRateLimitService,
    private readonly queue: ReceiptQueueService,
  ) {}

  async upload(input: {
    userId: string
    idempotencyKey: string
    file?: Buffer
    entryModeRaw?: string
  }): Promise<{ statusCode: number; body: ReceiptUploadResponse }> {
    const entryMode = this.parseEntryMode(input.entryModeRaw)

    if (!input.file?.length) {
      throw new ApiError('RECEIPT_FILE_MISSING', 'File is required', 400)
    }

    if (input.file.byteLength > this.env.UPLOAD_MAX_BYTES) {
      throw new ApiError('RECEIPT_FILE_TOO_LARGE', 'File is too large', 413)
    }

    const sourceSha256 = hashBuffer(input.file)
    const requestHash = hashRequest(sourceSha256, entryMode)

    await this.idempotency.assertNotReused(
      input.idempotencyKey,
      input.userId,
      UPLOAD_ENDPOINT,
      requestHash,
    )

    const cached = await this.idempotency.read(
      input.idempotencyKey,
      input.userId,
      UPLOAD_ENDPOINT,
    )
    if (cached) return cached

    const processed = await this.images.process(input.file)
    if (processed.sourceSha256 !== sourceSha256) {
      throw new ApiError('INTERNAL_ERROR', 'Internal server error', 500)
    }

    await this.uploadRateLimit.assertAllowed(input.userId)

    const duplicate = await this.prisma.receipt.findFirst({
      where: {
        userId: input.userId,
        fileSha256: processed.sourceSha256,
        deletedAt: null,
      },
    })

    if (duplicate) {
      const body: ReceiptUploadResponse = {
        receiptId: duplicate.id,
        processingStatus: duplicate.processingStatus,
        duplicate: true,
      }
      await this.idempotency.save(
        input.idempotencyKey,
        input.userId,
        UPLOAD_ENDPOINT,
        requestHash,
        200,
        body,
      )
      return { statusCode: 200, body }
    }

    const user = await this.prisma.user.findFirst({
      where: { id: input.userId, deletedAt: null },
    })
    if (!user) {
      throw new ApiError('AUTH_UNAUTHENTICATED', 'Authentication required', 401)
    }

    const receiptId = randomUUID()
    const imageKey = this.storage.receiptImageKey(input.userId, receiptId)
    const thumbnailKey = this.storage.receiptThumbnailKey(input.userId, receiptId)
    const processingStatus: ProcessingStatus = entryMode === 'MANUAL' ? 'SKIPPED' : 'PENDING'
    const requestId = getRequestId() ?? randomUUID()

    await this.storage.putObject(imageKey, processed.image, processed.mimeType)
    await this.storage.putObject(thumbnailKey, processed.thumbnail, processed.mimeType)

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.receipt.create({
          data: {
            id: receiptId,
            userId: input.userId,
            currency: user.baseCurrency,
            imageKey,
            thumbnailKey,
            fileSha256: processed.sourceSha256,
            fileSizeBytes: processed.sourceBytes,
            mimeType: processed.mimeType,
            entryMode,
            processingStatus,
            ...(entryMode === 'SCAN'
              ? {
                  jobs: {
                    create: {
                      requestId,
                      extractorKind: this.env.EXTRACTOR_KIND,
                      status: 'WAITING',
                    },
                  },
                }
              : {}),
          },
        })
      })
    } catch (error) {
      await this.storage.deleteObject(imageKey).catch(() => undefined)
      await this.storage.deleteObject(thumbnailKey).catch(() => undefined)
      throw error
    }

    if (entryMode === 'SCAN') {
      await this.queue.enqueue({ receiptId, userId: input.userId, requestId })
    }

    const body: ReceiptUploadResponse = {
      receiptId,
      processingStatus,
      duplicate: false,
    }

    await this.idempotency.save(
      input.idempotencyKey,
      input.userId,
      UPLOAD_ENDPOINT,
      requestHash,
      202,
      body,
    )

    return { statusCode: 202, body }
  }

  private parseEntryMode(raw?: string): EntryMode {
    if (!raw) return 'SCAN'
    const parsed = EntryModeSchema.safeParse(raw)
    if (!parsed.success) {
      throw new ApiError('VALIDATION_FAILED', 'Invalid entryMode', 422)
    }
    return parsed.data
  }
}
