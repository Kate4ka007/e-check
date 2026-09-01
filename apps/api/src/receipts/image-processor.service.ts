import { Injectable } from '@nestjs/common'
import { ApiError } from '@receipt-tracker/contracts'
import sharp from 'sharp'
import { detectImageMime, hashBuffer } from './file-signature'

const IMAGE_MAX_SIDE = 2000
const THUMB_MAX_SIDE = 400
const MIN_SIDE = 200
const MAX_SIDE = 10_000
const MIN_BYTES = 1024

export interface ProcessedImage {
  sourceSha256: string
  sourceBytes: number
  mimeType: string
  image: Buffer
  thumbnail: Buffer
  width: number
  height: number
}

@Injectable()
export class ImageProcessorService {
  assertSupported(buffer: Buffer): string {
    const mime = detectImageMime(buffer)
    if (!mime) {
      throw new ApiError('RECEIPT_FILE_TYPE_UNSUPPORTED', 'Unsupported file type', 415)
    }
    return mime
  }

  async process(buffer: Buffer): Promise<ProcessedImage> {
    if (buffer.byteLength < MIN_BYTES) {
      throw new ApiError('RECEIPT_IMAGE_INVALID', 'Image is too small', 422)
    }

    const mimeType = this.assertSupported(buffer)
    const sourceSha256 = hashBuffer(buffer)

    try {
      const image = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize({
          width: IMAGE_MAX_SIDE,
          height: IMAGE_MAX_SIDE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer({ resolveWithObject: true })

      if (image.info.width < MIN_SIDE || image.info.height < MIN_SIDE) {
        throw new ApiError('RECEIPT_IMAGE_INVALID', 'Image dimensions are too small', 422)
      }

      if (image.info.width > MAX_SIDE || image.info.height > MAX_SIDE) {
        throw new ApiError('RECEIPT_IMAGE_INVALID', 'Image dimensions are too large', 422)
      }

      const thumbnail = await sharp(image.data)
        .resize({
          width: THUMB_MAX_SIDE,
          height: THUMB_MAX_SIDE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer()

      return {
        sourceSha256,
        sourceBytes: buffer.byteLength,
        mimeType: 'image/jpeg',
        image: image.data,
        thumbnail,
        width: image.info.width,
        height: image.info.height,
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError('RECEIPT_IMAGE_INVALID', 'Invalid image file', 422)
    }
  }
}
