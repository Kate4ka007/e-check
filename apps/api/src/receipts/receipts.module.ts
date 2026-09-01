import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { StorageModule } from '../storage/storage.module'
import { IdempotencyService } from './idempotency.service'
import { ImageProcessorService } from './image-processor.service'
import { ReceiptQueueService } from './receipt-queue.service'
import { ReceiptsController } from './receipts.controller'
import { ReceiptsService } from './receipts.service'
import { UploadRateLimitService } from './upload-rate-limit.service'

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [ReceiptsController],
  providers: [
    ReceiptsService,
    ImageProcessorService,
    IdempotencyService,
    UploadRateLimitService,
    ReceiptQueueService,
  ],
})
export class ReceiptsModule {}
