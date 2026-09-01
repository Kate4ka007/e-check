import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import * as Sentry from '@sentry/node'
import { AppModule } from './app.module'
import { loadEnv } from './config/env.schema'

async function bootstrap() {
  const env = loadEnv()

  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies
          delete event.request.headers?.cookie
          delete event.request.data
        }
        return event
      },
    })
  }

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
