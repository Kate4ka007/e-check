import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { config } from './config.js'

export interface PreparedImage {
  /** JPEG после поворота по EXIF и уменьшения */
  buffer: Buffer
  dataUrl: string
  /** Хеш исходного файла, до обработки — ключ кэша и дедупликации */
  sourceSha256: string
  sourceBytes: number
  width: number
  height: number
  preparedBytes: number
}

/**
 * Готовит изображение к отправке модели.
 *
 * Уменьшение до 2000 px по длинной стороне сокращает вес фотографии
 * с телефона примерно в десять раз. Текст чека при этом остаётся читаемым,
 * а число токенов на изображение падает кратно.
 *
 * Поворот по EXIF обязателен: снятый вертикально чек иначе уедет набок.
 */
export async function prepareImage(filePath: string): Promise<PreparedImage> {
  const source = await readFile(filePath)
  const sourceSha256 = createHash('sha256').update(source).digest('hex')

  const pipeline = sharp(source, { failOn: 'none' })
    .rotate() // применяет ориентацию из EXIF и удаляет её
    .resize({
      width: config.IMAGE_MAX_SIDE,
      height: config.IMAGE_MAX_SIDE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })

  return {
    buffer: data,
    dataUrl: `data:image/jpeg;base64,${data.toString('base64')}`,
    sourceSha256,
    sourceBytes: source.byteLength,
    width: info.width,
    height: info.height,
    preparedBytes: data.byteLength,
  }
}

const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.avif', '.tiff'])

export function isSupportedImage(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.')
  return dot !== -1 && SUPPORTED.has(fileName.slice(dot).toLowerCase())
}
