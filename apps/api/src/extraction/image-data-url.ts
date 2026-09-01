export function toImageDataUrl(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64')
  return `data:${mimeType};base64,${base64}`
}
