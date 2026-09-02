import type { PrismaClient } from '../generated/prisma'
import type { Env } from '../config/env.schema'
import type { ReceiptExtractor } from '../extraction/receipt-extractor'
import type { ReceiptProcessingJobData } from '../receipts/receipt-queue.service'
import type { StorageService } from '../storage/storage.service'
import { isRetryableProcessingError } from './processing-retry'
import { ReceiptNormalizer } from './receipt-normalizer'
import { mergeReprocessResult } from './receipt-reprocess.merge'

export class ProcessingOrchestrator {
  private readonly normalizer: ReceiptNormalizer

  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: StorageService,
    private readonly extractor: ReceiptExtractor,
    private readonly env: Env,
  ) {
    this.normalizer = new ReceiptNormalizer(prisma)
  }

  async process(data: ReceiptProcessingJobData): Promise<void> {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: data.receiptId, userId: data.userId, deletedAt: null },
    })
    if (!receipt) return

    if (receipt.processingStatus === 'SKIPPED' || receipt.processingStatus === 'COMPLETED') {
      return
    }

    const job = await this.prisma.processingJob.findFirst({
      where: { receiptId: data.receiptId, requestId: data.requestId },
      orderBy: { createdAt: 'desc' },
    })
    if (!job) return

    if (!receipt.imageKey || !receipt.mimeType) {
      await this.failJob({
        jobId: job.id,
        receiptId: receipt.id,
        errorCode: 'RECEIPT_IMAGE_INVALID',
        errorMessage: 'Receipt has no image to process',
        finishedAt: new Date(),
      })
      return
    }

    const startedAt = new Date()

    await this.prisma.$transaction([
      this.prisma.processingJob.update({
        where: { id: job.id },
        data: {
          status: 'ACTIVE',
          attempt: { increment: 1 },
          startedAt,
        },
      }),
      this.prisma.receipt.update({
        where: { id: receipt.id },
        data: { processingStatus: 'PROCESSING' },
      }),
    ])

    try {
      const user = await this.prisma.user.findFirstOrThrow({
        where: { id: data.userId, deletedAt: null },
      })

      const merchants = await this.prisma.merchant.findMany({
        where: { userId: data.userId, deletedAt: null },
        take: 20,
        orderBy: { updatedAt: 'desc' },
        select: { name: true },
      })

      const imageBuffer = await this.storage.getObject(receipt.imageKey)
      const extraction = await this.extractor.extract({
        imageBuffer,
        mimeType: receipt.mimeType,
        hints: {
          expectedCurrency: user.baseCurrency,
          knownMerchants: merchants.map((merchant) => merchant.name),
        },
      })

      const finishedAt = new Date()

      if (!extraction.ok || !extraction.data) {
        await this.failJob({
          jobId: job.id,
          receiptId: receipt.id,
          errorCode: extraction.errorCode ?? 'EXTRACTION_FAILED',
          errorMessage: extraction.errorMessage ?? 'Extraction failed',
          providerModel: extraction.model,
          durationMs: extraction.durationMs,
          costMicros: extraction.costMicros,
          finishedAt,
        })
        return
      }

      const rawKey = this.storage.rawResultKey(data.userId, data.receiptId, job.id)
      await this.storage.putObject(
        rawKey,
        Buffer.from(JSON.stringify(extraction.raw)),
        'application/json',
      )

      const normalized = await this.normalizer.normalize({
        userId: data.userId,
        receiptId: data.receiptId,
        jobId: job.id,
        parsed: extraction.data,
        baseCurrency: user.baseCurrency,
        raw: extraction.raw,
        storageKey: rawKey,
      })

      const merged = mergeReprocessResult(receipt, normalized)

      await this.prisma.$transaction(async (tx) => {
        if (!merged.preserveItems) {
          await tx.receiptItem.deleteMany({ where: { receiptId: receipt.id } })
        }

        await tx.receipt.update({
          where: { id: receipt.id },
          data: {
            merchantId: merged.merchantId,
            purchasedAt: merged.purchasedAt,
            purchasedTime: merged.purchasedTime,
            currency: merged.currency,
            subtotalMinor: merged.subtotalMinor,
            taxTotalMinor: merged.taxTotalMinor,
            discountTotalMinor: merged.discountTotalMinor,
            totalMinor: merged.totalMinor,
            confidence: merged.confidence,
            fieldSources: merged.fieldSources,
            processingStatus: 'COMPLETED',
          },
        })

        if (!merged.preserveItems && merged.items.length > 0) {
          await tx.receiptItem.createMany({
            data: merged.items.map((item) => ({
              id: item.id,
              receiptId: receipt.id,
              categoryId: item.categoryId,
              position: item.position,
              name: item.name,
              lineType: item.lineType,
              quantity: item.quantity,
              unit: item.unit,
              unitPriceMinor: item.unitPriceMinor,
              totalPriceMinor: item.totalPriceMinor,
              confidence: item.confidence,
            })),
          })
        }

        await tx.processingJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            providerModel: extraction.model,
            finishedAt,
            durationMs: extraction.durationMs,
            costMicros: extraction.costMicros,
            rawResultKey: merged.rawResultKey,
            rawResultExpiresAt: merged.rawResultExpiresAt,
            errorCode: null,
            errorMessage: null,
          },
        })
      })
    } catch (error) {
      await this.failJob({
        jobId: job.id,
        receiptId: receipt.id,
        errorCode: 'EXTRACTION_FAILED',
        errorMessage: (error as Error).message,
        finishedAt: new Date(),
      })
    }
  }

  private async failJob(input: {
    jobId: string
    receiptId: string
    errorCode: string
    errorMessage: string
    providerModel?: string
    durationMs?: number
    costMicros?: number
    finishedAt: Date
  }): Promise<void> {
    const job = await this.prisma.processingJob.findUnique({ where: { id: input.jobId } })
    const attempts = job?.attempt ?? 1
    const maxAttempts = job?.maxAttempts ?? this.env.EXTRACTOR_MAX_ATTEMPTS
    const retry = isRetryableProcessingError(input.errorCode) && attempts < maxAttempts

    await this.prisma.$transaction([
      this.prisma.processingJob.update({
        where: { id: input.jobId },
        data: {
          status: retry ? 'RETRYING' : 'FAILED',
          providerModel: input.providerModel,
          finishedAt: input.finishedAt,
          durationMs: input.durationMs,
          costMicros: input.costMicros,
          errorCode: input.errorCode,
          errorMessage: input.errorMessage,
        },
      }),
      this.prisma.receipt.update({
        where: { id: input.receiptId },
        data: { processingStatus: retry ? 'PROCESSING' : 'FAILED' },
      }),
    ])

    if (retry) {
      throw new Error(input.errorMessage)
    }
  }
}

export function createProcessingOrchestrator(deps: {
  prisma: PrismaClient
  storage: StorageService
  extractor: ReceiptExtractor
  env: Env
}): ProcessingOrchestrator {
  return new ProcessingOrchestrator(deps.prisma, deps.storage, deps.extractor, deps.env)
}
