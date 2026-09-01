/**
 * Ставит в очередь повторное распознавание чеков, обработанных mock или GPT.
 *
 *   pnpm --filter @receipt-tracker/api reprocess:bad-models
 */
import { randomUUID } from 'node:crypto'
import { Queue } from 'bullmq'
import { loadEnv } from '../config/env.schema'
import { PrismaClient } from '../generated/prisma'
import { RECEIPT_PROCESSING_QUEUE } from '../receipts/receipt-queue.service'

const BAD_MODELS = new Set(['mock'])
const BAD_MODEL_PATTERNS = [/gpt/i, /openai/i]

function isBadModel(model: string | null | undefined): boolean {
  if (!model) return false
  if (BAD_MODELS.has(model)) return true
  return BAD_MODEL_PATTERNS.some((pattern) => pattern.test(model))
}

async function main() {
  const env = loadEnv()
  const prisma = new PrismaClient()
  const queue = new Queue(RECEIPT_PROCESSING_QUEUE, {
    connection: { url: env.REDIS_URL },
  })

  const receipts = await prisma.receipt.findMany({
    where: { deletedAt: null, entryMode: 'SCAN', processingStatus: 'COMPLETED' },
    include: { jobs: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })

  const toReprocess = receipts.filter((receipt) => isBadModel(receipt.jobs[0]?.providerModel))

  if (toReprocess.length === 0) {
    console.log('Нет чеков с mock/GPT — перераспознавание не требуется.')
    await queue.close()
    await prisma.$disconnect()
    return
  }

  for (const receipt of toReprocess) {
    const requestId = randomUUID()
    const model = receipt.jobs[0]?.providerModel

    await prisma.$transaction(async (tx) => {
      await tx.receipt.update({
        where: { id: receipt.id },
        data: { processingStatus: 'PENDING' },
      })
      await tx.processingJob.create({
        data: {
          receiptId: receipt.id,
          requestId,
          extractorKind: env.EXTRACTOR_KIND,
          status: 'WAITING',
        },
      })
    })

    await queue.add(
      'process',
      { receiptId: receipt.id, userId: receipt.userId, requestId },
      {
        jobId: `${receipt.id}-${requestId.replace(/-/g, '')}`,
        attempts: env.EXTRACTOR_MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: 2000 },
      },
    )

    console.log(`В очередь: ${receipt.id} (было: ${model})`)
  }

  console.log(`Готово: ${toReprocess.length} чек(ов). Worker должен быть запущен.`)

  await queue.close()
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
