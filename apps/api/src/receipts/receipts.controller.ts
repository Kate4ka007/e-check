import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiError, type ReceiptUploadResponse } from '@receipt-tracker/contracts'
import type { Request, Response } from 'express'
import { memoryStorage } from 'multer'
import { z } from 'zod'
import { AuthGuard } from '../auth/auth.guard'
import { ReceiptsService } from './receipts.service'

const IdempotencyKeySchema = z.uuid()

@Controller('receipts')
@UseGuards(AuthGuard)
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Post('upload')
  @HttpCode(202)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReceiptUploadResponse> {
    const idempotencyKey = IdempotencyKeySchema.safeParse(idempotencyKeyHeader)
    if (!idempotencyKey.success) {
      throw new ApiError('VALIDATION_FAILED', 'Idempotency-Key header is required', 422)
    }

    const entryMode =
      typeof req.body?.entryMode === 'string' ? req.body.entryMode : undefined

    const result = await this.receipts.upload({
      userId: req.userId!,
      idempotencyKey: idempotencyKey.data,
      file: file?.buffer,
      entryModeRaw: entryMode,
    })

    res.status(result.statusCode)
    return result.body
  }
}
