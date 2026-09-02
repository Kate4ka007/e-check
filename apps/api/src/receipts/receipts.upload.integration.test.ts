import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../test/create-test-app'
import { disconnectTestPrisma, getTestPrisma, resetTestData } from '../test/test-db'

function uniquePassword(): string {
  return `Tst-${randomUUID().slice(0, 12)}!9Xk`
}

async function registerAgent(app: INestApplication) {
  const agent = request.agent(app.getHttpServer())
  await agent
    .post('/api/v1/auth/register')
    .send({
      email: `upload-${randomUUID()}@example.com`,
      password: uniquePassword(),
      timezone: 'Europe/Minsk',
      baseCurrency: 'BYN',
    })
    .expect(201)
  return agent
}

let testImage: Buffer

describe('receipt upload integration', () => {
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

    app = await createTestApp()
  })

  afterEach(async () => {
    await resetTestData()
  })

  afterAll(async () => {
    await app.close()
    await disconnectTestPrisma()
  })

  it('uploads a receipt and enqueues processing', async () => {
    const agent = await registerAgent(app)
    const idempotencyKey = randomUUID()

    const response = await agent
      .post('/api/v1/receipts/upload')
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', testImage, 'receipt.jpg')
      .expect(202)

    expect(response.body).toMatchObject({
      duplicate: false,
      processingStatus: 'PENDING',
    })
    expect(response.body.receiptId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )

    const prisma = getTestPrisma()
    const receipt = await prisma.receipt.findUnique({ where: { id: response.body.receiptId } })
    expect(receipt).not.toBeNull()
    expect(receipt?.processingStatus).toBe('PENDING')

    const jobs = await prisma.processingJob.findMany({
      where: { receiptId: response.body.receiptId },
    })
    expect(jobs).toHaveLength(1)
  })

  it('returns the same response for the same idempotency key', async () => {
    const agent = await registerAgent(app)
    const idempotencyKey = randomUUID()

    const first = await agent
      .post('/api/v1/receipts/upload')
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', testImage, 'receipt.jpg')
      .expect(202)

    const second = await agent
      .post('/api/v1/receipts/upload')
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', testImage, 'receipt.jpg')
      .expect(202)

    expect(second.body).toEqual(first.body)

    const prisma = getTestPrisma()
    const receipts = await prisma.receipt.findMany()
    expect(receipts).toHaveLength(1)
  })

  it('returns duplicate when uploading the same file again with a new key', async () => {
    const agent = await registerAgent(app)

    const first = await agent
      .post('/api/v1/receipts/upload')
      .set('Idempotency-Key', randomUUID())
      .attach('file', testImage, 'receipt.jpg')
      .expect(202)

    const duplicate = await agent
      .post('/api/v1/receipts/upload')
      .set('Idempotency-Key', randomUUID())
      .attach('file', testImage, 'receipt.jpg')
      .expect(200)

    expect(duplicate.body).toMatchObject({
      receiptId: first.body.receiptId,
      duplicate: true,
    })

    const prisma = getTestPrisma()
    const receipts = await prisma.receipt.findMany()
    expect(receipts).toHaveLength(1)
  })

  it('rejects the same idempotency key with a different file', async () => {
    const agent = await registerAgent(app)
    const idempotencyKey = randomUUID()
    const otherImage = await sharp({
      create: {
        width: 500,
        height: 700,
        channels: 3,
        background: { r: 200, g: 220, b: 240 },
      },
    })
      .jpeg()
      .toBuffer()

    await agent
      .post('/api/v1/receipts/upload')
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', testImage, 'receipt.jpg')
      .expect(202)

    const conflict = await agent
      .post('/api/v1/receipts/upload')
      .set('Idempotency-Key', idempotencyKey)
      .attach('file', otherImage, 'other.jpg')
      .expect(409)

    expect(conflict.body.code).toBe('IDEMPOTENCY_KEY_REUSED')
  })

  it('creates a manual entry receipt without a processing job', async () => {
    const agent = await registerAgent(app)

    const response = await agent
      .post('/api/v1/receipts/upload')
      .set('Idempotency-Key', randomUUID())
      .field('entryMode', 'MANUAL')
      .attach('file', testImage, 'receipt.jpg')
      .expect(202)

    expect(response.body.processingStatus).toBe('SKIPPED')

    const prisma = getTestPrisma()
    const jobs = await prisma.processingJob.findMany({
      where: { receiptId: response.body.receiptId },
    })
    expect(jobs).toHaveLength(0)
  })

  it('creates a manual entry receipt without a file', async () => {
    const agent = await registerAgent(app)

    const response = await agent
      .post('/api/v1/receipts/upload')
      .set('Idempotency-Key', randomUUID())
      .field('entryMode', 'MANUAL')
      .expect(202)

    expect(response.body.processingStatus).toBe('SKIPPED')
    expect(response.body.duplicate).toBe(false)

    const prisma = getTestPrisma()
    const receipt = await prisma.receipt.findUnique({ where: { id: response.body.receiptId } })
    expect(receipt?.entryMode).toBe('MANUAL')
    expect(receipt?.processingStatus).toBe('SKIPPED')
    expect(receipt?.imageKey).toBeNull()
    expect(receipt?.fileSha256).toBeNull()

    const detail = await agent.get(`/api/v1/receipts/${response.body.receiptId}`).expect(200)
    expect(detail.body.imageUrl).toBeNull()
    expect(detail.body.entryMode).toBe('MANUAL')
    expect(detail.body.items).toEqual([])
  })
})
