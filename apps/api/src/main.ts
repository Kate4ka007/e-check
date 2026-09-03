import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { loadEnv } from './config/env.schema'

async function bootstrap() {
  const env = loadEnv()

  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))

  app.setGlobalPrefix('api/v1')
  app.use(helmet())
  app.use(cookieParser())
  app.use(express.json({ limit: '1mb' }))
  app.enableCors({
    origin: env.APP_URL,
    credentials: true,
  })

  await app.listen(env.PORT)
}

bootstrap()
