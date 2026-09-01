import { createHash } from 'node:crypto'

const SIGNATURES: Array<{ mime: string; check: (bytes: Buffer) => boolean }> = [
  { mime: 'image/jpeg', check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    check: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47,
  },
  {
    mime: 'image/webp',
    check: (b) =>
      b.length >= 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    mime: 'image/heic',
    check: (b) => b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp' && hasHeicBrand(b),
  },
  {
    mime: 'image/avif',
    check: (b) =>
      b.length >= 12 &&
      b.toString('ascii', 4, 8) === 'ftyp' &&
      b.toString('ascii', 8, 12).includes('avif'),
  },
  {
    mime: 'image/tiff',
    check: (b) =>
      b.length >= 4 &&
      ((b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4d && b[1] === 0x4d)),
  },
]

function hasHeicBrand(bytes: Buffer): boolean {
  const brand = bytes.toString('ascii', 8, 12)
  return brand.startsWith('heic') || brand.startsWith('heif') || brand.startsWith('mif1')
}

export function detectImageMime(buffer: Buffer): string | null {
  for (const signature of SIGNATURES) {
    if (signature.check(buffer)) return signature.mime
  }
  return null
}

export function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export function hashRequest(fileSha256: string, entryMode: string): string {
  return createHash('sha256').update(`${fileSha256}:${entryMode}`).digest('hex')
}
