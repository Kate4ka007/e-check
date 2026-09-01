import { Inject, Injectable } from '@nestjs/common'
import {
  ApiError,
  EntryModeSchema,
  parseQuantity,
  validateReceiptSum,
  type EntryMode,
  type ProcessingStage,
  type ProcessingStatus,
  type ReceiptConfirmResponse,
  type ReceiptDetail,
  type ReceiptListItem,
  type ReceiptListResponse,
  type ReceiptPatch,
  type ReceiptProcessingResponse,
  type ReceiptReprocessResponse,
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
import { ReceiptCategoryResolver } from './receipt-category.resolver'
import { toReceiptDetail } from './receipt-detail.mapper'
import { ReceiptQueueService } from './receipt-queue.service'
import { UploadRateLimitService } from './upload-rate-limit.service'

const UPLOAD_ENDPOINT = 'POST /receipts/upload'

const RECEIPT_INCLUDE = {
  merchant: { select: { id: true, name: true } },
  items: { orderBy: { position: 'asc' as const } },
}

function normalizeMerchantName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

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

  async list(userId: string, limit = 50): Promise<ReceiptListResponse> {
    const receipts = await this.prisma.receipt.findMany({
      where: { userId, deletedAt: null },
      include: {
        merchant: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ purchasedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    })

    const items: ReceiptListItem[] = await Promise.all(
      receipts.map(async (receipt) => ({
        id: receipt.id,
        purchasedAt: receipt.purchasedAt
          ? receipt.purchasedAt.toISOString().slice(0, 10)
          : null,
        currency: receipt.currency,
        totalMinor: receipt.totalMinor,
        status: receipt.status,
        processingStatus: receipt.processingStatus,
        confidence: receipt.confidence,
        thumbnailUrl: receipt.thumbnailKey
          ? await this.storage.getSignedUrl(receipt.thumbnailKey)
          : null,
        merchant: receipt.merchant,
        itemCount: receipt._count.items,
      })),
    )

    return { items }
  }

  async getById(userId: string, receiptId: string): Promise<ReceiptDetail> {
    const receipt = await this.loadReceiptRecord(userId, receiptId)
    if (!receipt) {
      throw new ApiError('NOT_FOUND', 'Receipt not found', 404)
    }
    return this.toDetail(receipt)
  }

  async patch(userId: string, receiptId: string, patch: ReceiptPatch): Promise<ReceiptDetail> {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, userId, deletedAt: null },
      include: RECEIPT_INCLUDE,
    })
    if (!receipt) {
      throw new ApiError('NOT_FOUND', 'Receipt not found', 404)
    }

    const fieldSources = this.readFieldSources(receipt.fieldSources)

    if (patch.merchantName !== undefined) {
      fieldSources.merchantName = 'USER'
    }
    if (patch.purchasedAt !== undefined) fieldSources.purchasedAt = 'USER'
    if (patch.purchasedTime !== undefined) fieldSources.purchasedTime = 'USER'
    if (patch.currency !== undefined) fieldSources.currency = 'USER'
    if (patch.subtotalMinor !== undefined) fieldSources.subtotalMinor = 'USER'
    if (patch.taxTotalMinor !== undefined) fieldSources.taxTotalMinor = 'USER'
    if (patch.discountTotalMinor !== undefined) fieldSources.discountTotalMinor = 'USER'
    if (patch.totalMinor !== undefined) fieldSources.totalMinor = 'USER'
    if (patch.note !== undefined) fieldSources.note = 'USER'
    if (patch.items !== undefined) fieldSources.items = 'USER'

    const categories = await ReceiptCategoryResolver.create(this.prisma)

    await this.prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {
        fieldSources,
      }

      if (patch.merchantName !== undefined) {
        if (patch.merchantName) {
          data.merchantId = await this.findOrCreateMerchant(tx, userId, patch.merchantName)
        } else {
          data.merchantId = null
        }
      }

      if (patch.purchasedAt !== undefined) {
        data.purchasedAt = patch.purchasedAt
          ? new Date(`${patch.purchasedAt}T12:00:00Z`)
          : null
      }
      if (patch.purchasedTime !== undefined) data.purchasedTime = patch.purchasedTime
      if (patch.currency !== undefined && patch.currency) data.currency = patch.currency
      if (patch.subtotalMinor !== undefined) data.subtotalMinor = patch.subtotalMinor
      if (patch.taxTotalMinor !== undefined) data.taxTotalMinor = patch.taxTotalMinor
      if (patch.discountTotalMinor !== undefined) data.discountTotalMinor = patch.discountTotalMinor
      if (patch.totalMinor !== undefined) data.totalMinor = patch.totalMinor
      if (patch.note !== undefined) data.note = patch.note

      await tx.receipt.update({
        where: { id: receiptId },
        data,
      })

      if (patch.items !== undefined) {
        await tx.receiptItem.deleteMany({ where: { receiptId } })

        if (patch.items.length > 0) {
          await tx.receiptItem.createMany({
            data: patch.items.map((item, index) => ({
              id: item.id && !item.id.startsWith('new-') ? item.id : randomUUID(),
              receiptId,
              categoryId: categories.resolveDbId(item.categoryId),
              position: index,
              name: item.name,
              lineType: item.lineType,
              quantity: parseQuantity(item.quantity),
              unit: item.unit,
              unitPriceMinor: item.unitPriceMinor,
              totalPriceMinor: item.totalPriceMinor,
              confidence: null,
            })),
          })
        }
      }
    })

    return this.getById(userId, receiptId)
  }

  async confirm(userId: string, receiptId: string): Promise<ReceiptConfirmResponse> {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, userId, deletedAt: null },
      include: { items: { orderBy: { position: 'asc' } } },
    })
    if (!receipt) {
      throw new ApiError('NOT_FOUND', 'Receipt not found', 404)
    }

    const items = receipt.items.map((item) => ({
      lineType: item.lineType,
      totalPriceMinor: item.totalPriceMinor,
    }))
    const validation = validateReceiptSum(items, receipt.totalMinor)
    const warnings: ReceiptConfirmResponse['warnings'] = []

    if (!validation.matchesTotal) {
      warnings.push({
        code: 'ITEMS_SUM_MISMATCH',
        differenceMinor: validation.differenceMinor,
      })
    }

    if (receipt.status === 'CONFIRMED') {
      return { status: 'CONFIRMED', warnings }
    }

    const missing: string[] = []
    if (!receipt.purchasedAt) missing.push('purchasedAt')
    if (!receipt.currency) missing.push('currency')
    if (receipt.totalMinor === null) missing.push('totalMinor')

    if (missing.length > 0) {
      throw new ApiError('RECEIPT_INCOMPLETE', 'Required fields are missing', 422, {
        fields: missing,
      })
    }

    await this.prisma.receipt.update({
      where: { id: receiptId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    })

    return { status: 'CONFIRMED', warnings }
  }

  async reprocess(userId: string, receiptId: string): Promise<ReceiptReprocessResponse> {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, userId, deletedAt: null, entryMode: 'SCAN' },
    })
    if (!receipt) {
      throw new ApiError('NOT_FOUND', 'Receipt not found', 404)
    }

    if (receipt.processingStatus === 'PROCESSING' || receipt.processingStatus === 'PENDING') {
      throw new ApiError('PROCESSING_ALREADY_RUNNING', 'Processing is already running', 409)
    }

    const requestId = getRequestId() ?? randomUUID()

    await this.prisma.$transaction(async (tx) => {
      await tx.receipt.update({
        where: { id: receiptId },
        data: { processingStatus: 'PENDING' },
      })
      await tx.processingJob.create({
        data: {
          receiptId,
          requestId,
          extractorKind: this.env.EXTRACTOR_KIND,
          status: 'WAITING',
        },
      })
    })

    await this.queue.enqueue({ receiptId, userId, requestId })

    return { receiptId, processingStatus: 'PENDING' }
  }

  private async toDetail(
    receipt: Awaited<ReturnType<ReceiptsService['loadReceiptRecord']>>,
  ): Promise<ReceiptDetail> {
    if (!receipt) {
      throw new ApiError('NOT_FOUND', 'Receipt not found', 404)
    }

    const categories = await ReceiptCategoryResolver.create(this.prisma)
    const [imageUrl, thumbnailUrl] = await Promise.all([
      this.storage.getSignedUrl(receipt.imageKey),
      receipt.thumbnailKey
        ? this.storage.getSignedUrl(receipt.thumbnailKey)
        : Promise.resolve(null),
    ])

    return toReceiptDetail(receipt, categories, { imageUrl, thumbnailUrl })
  }

  private loadReceiptRecord(userId: string, receiptId: string) {
    return this.prisma.receipt.findFirst({
      where: { id: receiptId, userId, deletedAt: null },
      include: RECEIPT_INCLUDE,
    })
  }

  private readFieldSources(value: unknown): Record<string, 'AI' | 'USER' | 'OCR'> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ...(value as Record<string, 'AI' | 'USER' | 'OCR'>) }
    }
    return {}
  }

  private async findOrCreateMerchant(
    tx: Pick<PrismaService, 'merchant'>,
    userId: string,
    name: string,
  ): Promise<string> {
    const normalizedName = normalizeMerchantName(name)
    const existing = await tx.merchant.findFirst({
      where: { userId, normalizedName, deletedAt: null },
    })
    if (existing) return existing.id

    const created = await tx.merchant.create({
      data: {
        userId,
        name: name.trim(),
        normalizedName,
      },
    })
    return created.id
  }

  async getProcessingStatus(
    userId: string,
    receiptId: string,
  ): Promise<ReceiptProcessingResponse> {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, userId, deletedAt: null },
    })
    if (!receipt) {
      throw new ApiError('NOT_FOUND', 'Receipt not found', 404)
    }

    const job = await this.prisma.processingJob.findFirst({
      where: { receiptId },
      orderBy: { createdAt: 'desc' },
    })

    return {
      receiptId: receipt.id,
      processingStatus: receipt.processingStatus,
      stage: this.mapProcessingStage(receipt.processingStatus),
      startedAt: job?.startedAt?.toISOString() ?? null,
      estimatedSeconds: receipt.processingStatus === 'PROCESSING' ? 15 : null,
      error: this.mapProcessingError(receipt.processingStatus, job),
    }
  }

  private mapProcessingStage(status: ProcessingStatus): ProcessingStage | null {
    if (status === 'PENDING') return 'PREPARING'
    if (status === 'PROCESSING') return 'EXTRACTING'
    return null
  }

  private mapProcessingError(
    status: ProcessingStatus,
    job: {
      errorCode: string | null
      attempt: number
      maxAttempts: number
    } | null,
  ): ReceiptProcessingResponse['error'] {
    if (status !== 'FAILED' || !job) return null

    const code =
      job.errorCode === 'EXTRACTION_INVALID_RESPONSE'
        ? 'EXTRACTION_INVALID_RESPONSE'
        : 'EXTRACTION_FAILED'

    return {
      code,
      retryable: job.attempt < job.maxAttempts,
    }
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
