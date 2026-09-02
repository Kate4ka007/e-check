import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import { Queue } from 'bullmq'
import { ENV } from '../config/config.module'
import type { Env } from '../config/env.schema'
import { RECEIPT_QUEUE_DEFAULT_JOB_OPTIONS } from './receipt-queue.config'

export const RECEIPT_PROCESSING_QUEUE = 'receipt-processing'

export interface ReceiptProcessingJobData {
  receiptId: string
  userId: string
  requestId: string
}

@Injectable()
export class ReceiptQueueService implements OnModuleDestroy {
  private readonly queue: Queue<ReceiptProcessingJobData>

  constructor(@Inject(ENV) private readonly env: Env) {
    this.queue = new Queue<ReceiptProcessingJobData>(RECEIPT_PROCESSING_QUEUE, {
      connection: { url: env.REDIS_URL },
      defaultJobOptions: RECEIPT_QUEUE_DEFAULT_JOB_OPTIONS,
    })
  }

  async enqueue(data: ReceiptProcessingJobData): Promise<void> {
    await this.queue.add('process', data, {
      jobId: `${data.receiptId}-${data.requestId.replace(/-/g, '')}`,
      attempts: this.env.EXTRACTOR_MAX_ATTEMPTS,
      backoff: { type: 'exponential', delay: 2000 },
    })
  }

  async onModuleDestroy() {
    await this.queue.close()
  }
}
