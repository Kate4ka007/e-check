import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../test/create-test-app'
import {
  disconnectTestPrisma,
  ensureSystemCategories,
  getTestPrisma,
  resetTestData,
} from '../test/test-db'
import { createWorkerDeps } from '../worker/create-worker-deps'

function uniquePassword(): string {
  return `Tst-${randomUUID().slice(0, 12)}!9Xk`
}

async function registerAgent(app: INestApplication) {
  const agent = request.agent(app.getHttpServer())
  await agent
    .post('/api/v1/auth/register')
    .send({
      email: `processing-${randomUUID()}@example.com`,
      password: uniquePassword(),
      timezone: 'Europe/Minsk',
      baseCurrency: 'BYN',
    })
    .expect(201)
  return agent
}

let testImage: Buffer

describe('receipt processing integration', () => {
  let app: INestApplication

  beforeAll(async () => {
    testImage = await sharp({
      create: {
        width: 480,
        height: 640,
        channels: 3,
        background: { r: 240, g: 240, b: 240 },
      },
    })
      .jpeg()
      .toBuffer()

    await ensureSystemCategories()
    app = await createTestApp()
  })

  afterEach(async () => {
    await resetTestData()
    await ensureSystemCategories()
  })

  afterAll(async () => {
    await app.close()
    await disconnectTestPrisma()
  })

  it('processes an uploaded receipt with MockExtractor and exposes status API', async () => {
    const agent = await registerAgent(app)
    const idempotencyKey = randomUUID()

    const upload = await agent
      .post('/api/v1/receipts/upload')
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', testImage, 'receipt.jpg')
      .expect(202)

    const receiptId = upload.body.receiptId as string

    const pending = await agent.get(`/api/v1/receipts/${receiptId}/processing`).expect(200)
    expect(pending.body).toMatchObject({
      receiptId,
      processingStatus: 'PENDING',
      stage: 'PREPARING',
      error: null,
    })

    const { orchestrator } = createWorkerDeps()
    await orchestrator.process({
      receiptId,
      userId: (await getTestPrisma().receipt.findUniqueOrThrow({ where: { id: receiptId } }))
        .userId,
      requestId: (
        await getTestPrisma().processingJob.findFirstOrThrow({
          where: { receiptId },
        })
      ).requestId,
    })

    const completed = await agent.get(`/api/v1/receipts/${receiptId}/processing`).expect(200)
    expect(completed.body).toMatchObject({
      receiptId,
      processingStatus: 'COMPLETED',
      stage: null,
      error: null,
    })

    const prisma = getTestPrisma()
    const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: receiptId } })
    expect(receipt.processingStatus).toBe('COMPLETED')
    expect(receipt.totalMinor).toBe(570)
    expect(receipt.merchantId).toBeTruthy()

    const items = await prisma.receiptItem.findMany({ where: { receiptId } })
    expect(items).toHaveLength(2)
  })
})
