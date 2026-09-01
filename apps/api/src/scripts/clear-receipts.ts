/**
 * Удаляет все чеки из dev-базы и их файлы из S3/MinIO.
 *
 *   pnpm --filter @receipt-tracker/api clear:receipts
 */
import { PrismaClient } from '../generated/prisma'
import { loadEnv } from '../config/env.schema'
import { StorageService } from '../storage/storage.service'

async function main() {
  const env = loadEnv()
  const prisma = new PrismaClient()
  const storage = new StorageService(env)

  const receipts = await prisma.receipt.findMany({
    select: { id: true, imageKey: true, thumbnailKey: true },
  })

  if (receipts.length === 0) {
    console.log('Чеков в базе нет.')
    await prisma.$disconnect()
    return
  }

  for (const receipt of receipts) {
    await storage.deleteObject(receipt.imageKey).catch(() => undefined)
    if (receipt.thumbnailKey) {
      await storage.deleteObject(receipt.thumbnailKey).catch(() => undefined)
    }
  }

  const deleted = await prisma.receipt.deleteMany()
  console.log(`Удалено чеков: ${deleted.count}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
