import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ENV } from '../config/config.module'
import type { Env } from '../config/env.schema'
import { isManagedObjectStorage, resolveS3ForcePathStyle } from './s3-client-options'

const SIGNED_URL_TTL_SECONDS = 15 * 60

function agentLog(
  location: string,
  message: string,
  hypothesisId: string,
  data: Record<string, unknown>,
) {
  const payload = {
    sessionId: 'd2849a',
    runId: 'pre-fix',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  }

  // Visible in Render logs when local ingest is unavailable.
  console.error(`[debug] ${JSON.stringify(payload)}`)

  // #region agent log
  fetch('http://127.0.0.1:7444/ingest/630473c8-0625-49c0-bf96-70c190742b5f', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'd2849a' },
    body: JSON.stringify(payload),
  }).catch(() => {})
  // #endregion
}

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly client: S3Client
  private readonly forcePathStyle: boolean

  constructor(@Inject(ENV) private readonly env: Env) {
    this.forcePathStyle = resolveS3ForcePathStyle(env)

    agentLog('storage.service.ts:constructor', 'S3 client config', 'H1', {
      endpointHost: new URL(env.S3_ENDPOINT).host,
      forcePathStyle: this.forcePathStyle,
      envForcePathStyle: env.S3_FORCE_PATH_STYLE,
      managedStorage: isManagedObjectStorage(env.S3_ENDPOINT),
    })

    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: this.forcePathStyle,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    })
  }

  onModuleInit() {
    return this.ensureBucket()
  }

  async ensureBucket(): Promise<void> {
    agentLog('storage.service.ts:ensureBucket', 'HeadBucket start', 'H1', {
      bucket: this.env.S3_BUCKET,
      forcePathStyle: this.forcePathStyle,
    })

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.env.S3_BUCKET }))
      agentLog('storage.service.ts:ensureBucket', 'HeadBucket ok', 'H1', {
        bucket: this.env.S3_BUCKET,
      })
    } catch (error) {
      agentLog('storage.service.ts:ensureBucket', 'HeadBucket failed', 'H1', {
        bucket: this.env.S3_BUCKET,
        errorName: error instanceof Error ? error.name : 'unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        hasAwsMetadata: typeof error === 'object' && error !== null && '$metadata' in error,
      })

      if (isManagedObjectStorage(this.env.S3_ENDPOINT)) {
        throw error
      }

      await this.client.send(new CreateBucketCommand({ Bucket: this.env.S3_BUCKET }))
    }
  }

  onModuleDestroy() {
    this.client.destroy()
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: key,
      }),
    )

    const body = response.Body
    if (!body) {
      throw new Error(`Empty object body for key ${key}`)
    }

    const chunks: Uint8Array[] = []
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: key,
      }),
    )
  }

  async getSignedUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.env.S3_BUCKET,
        Key: key,
      }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    )
  }

  receiptImageKey(userId: string, receiptId: string): string {
    return `receipts/${userId}/${receiptId}/original.jpg`
  }

  receiptThumbnailKey(userId: string, receiptId: string): string {
    return `receipts/${userId}/${receiptId}/thumb.jpg`
  }

  rawResultKey(userId: string, receiptId: string, jobId: string): string {
    return `receipts/${userId}/${receiptId}/raw/${jobId}.json`
  }
}
