import 'reflect-metadata'
import { Test } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import { AppModule } from '../app.module'

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication({ bufferLogs: true })
  app.setGlobalPrefix('api/v1')
  app.use(helmet())
  app.use(cookieParser())
  app.use(express.json({ limit: '1mb' }))
  await app.init()
  return app
}
