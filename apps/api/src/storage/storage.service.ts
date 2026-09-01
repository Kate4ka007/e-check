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

const SIGNED_URL_TTL_SECONDS = 15 * 60

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly client: S3Client

  constructor(@Inject(ENV) private readonly env: Env) {
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
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
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.env.S3_BUCKET }))
    } catch {
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
}
