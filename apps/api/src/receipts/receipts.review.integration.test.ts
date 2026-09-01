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
      email: `review-${randomUUID()}@example.com`,
      password: uniquePassword(),
      timezone: 'Europe/Minsk',
      baseCurrency: 'BYN',
    })
    .expect(201)
  return agent
}

async function uploadAndProcess(
  agent: Awaited<ReturnType<typeof registerAgent>>,
  image: Buffer,
) {
  const upload = await agent
    .post('/api/v1/receipts/upload')
    .set('Idempotency-Key', randomUUID())
    .attach('file', image, 'receipt.jpg')
    .expect(202)

  const receiptId = upload.body.receiptId as string
  const prisma = getTestPrisma()
  const receipt = await prisma.receipt.findUniqueOrThrow({ where: { id: receiptId } })
  const job = await prisma.processingJob.findFirstOrThrow({ where: { receiptId } })

  const { orchestrator } = createWorkerDeps()
  await orchestrator.process({
    receiptId,
    userId: receipt.userId,
    requestId: job.requestId,
  })

  return receiptId
}

let testImage: Buffer

describe('receipt review integration', () => {
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

  it('loads, patches and confirms a processed receipt', async () => {
    const agent = await registerAgent(app)
    const receiptId = await uploadAndProcess(agent, testImage)

    const detail = await agent.get(`/api/v1/receipts/${receiptId}`).expect(200)
    expect(detail.body).toMatchObject({
      id: receiptId,
      processingStatus: 'COMPLETED',
      status: 'DRAFT',
      merchant: { name: 'Mock Store' },
      currency: 'BYN',
      totalMinor: 570,
    })
    expect(detail.body.items).toHaveLength(2)
    expect(detail.body.imageUrl).toContain('X-Amz')
    expect(detail.body.validation.matchesTotal).toBe(true)

    const patched = await agent
      .patch(`/api/v1/receipts/${receiptId}`)
      .send({
        merchantName: 'Магазин пользователя',
        note: 'Проверено',
      })
      .expect(200)

    expect(patched.body.merchant.name).toBe('Магазин пользователя')
    expect(patched.body.note).toBe('Проверено')
    expect(patched.body.fieldSources.merchantName).toBe('USER')

    const confirmed = await agent.post(`/api/v1/receipts/${receiptId}/confirm`).expect(201)
    expect(confirmed.body).toMatchObject({
      status: 'CONFIRMED',
      warnings: [],
    })

    const afterConfirm = await agent.get(`/api/v1/receipts/${receiptId}`).expect(200)
    expect(afterConfirm.body.status).toBe('CONFIRMED')
    expect(afterConfirm.body.confirmedAt).toBeTruthy()
  })

  it('returns RECEIPT_INCOMPLETE when required fields are missing', async () => {
    const agent = await registerAgent(app)
    const receiptId = await uploadAndProcess(agent, testImage)

    await agent
      .patch(`/api/v1/receipts/${receiptId}`)
      .send({ purchasedAt: null, totalMinor: null })
      .expect(200)

    const response = await agent.post(`/api/v1/receipts/${receiptId}/confirm`).expect(422)
    expect(response.body.code).toBe('RECEIPT_INCOMPLETE')
    expect(response.body.details.fields).toContain('purchasedAt')
    expect(response.body.details.fields).toContain('totalMinor')
  })

  it('enqueues reprocess and rejects when already pending', async () => {
    const agent = await registerAgent(app)
    const receiptId = await uploadAndProcess(agent, testImage)

    const reprocess = await agent.post(`/api/v1/receipts/${receiptId}/reprocess`).expect(202)
    expect(reprocess.body).toMatchObject({
      receiptId,
      processingStatus: 'PENDING',
    })

    await agent.post(`/api/v1/receipts/${receiptId}/reprocess`).expect(409)
  })
})
