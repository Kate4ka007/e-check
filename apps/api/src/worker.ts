import { Worker } from 'bullmq'
import { ensureSystemCategories } from './categories/ensure-system-categories'
import { loadEnv } from './config/env.schema'
import {
  RECEIPT_PROCESSING_QUEUE,
  type ReceiptProcessingJobData,
} from './receipts/receipt-queue.service'
import { createWorkerDeps } from './worker/create-worker-deps'

async function main() {
  const env = loadEnv()
  const { prisma, storage, orchestrator } = createWorkerDeps(env)

  await prisma.$connect()
  await ensureSystemCategories(prisma)
  await storage.ensureBucket()

  const worker = new Worker<ReceiptProcessingJobData>(
    RECEIPT_PROCESSING_QUEUE,
    async (job) => {
      await orchestrator.process(job.data)
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 2,
    },
  )

  worker.on('failed', (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message)
  })

  const shutdown = async (signal: string) => {
    console.log(`Worker shutting down (${signal})`)
    await worker.close()
    await prisma.$disconnect()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  console.log(`Receipt worker listening on queue "${RECEIPT_PROCESSING_QUEUE}"`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
