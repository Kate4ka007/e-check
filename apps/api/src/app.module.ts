import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { APP_FILTER, APP_PIPE } from '@nestjs/core'
import { LoggerModule } from 'nestjs-pino'
import { ZodValidationPipe } from 'nestjs-zod'
import { AppConfigModule } from './config/config.module'
import { HttpExceptionFilter } from './common/http-exception.filter'
import { RequestIdMiddleware } from './common/request-id.middleware'
import { AuthModule } from './auth/auth.module'
import { HealthModule } from './health/health.module'
import { PrismaModule } from './prisma/prisma.module'
import { RedisModule } from './redis/redis.module'
import { ReceiptsModule } from './receipts/receipts.module'

@Module({
  imports: [
    AppConfigModule,
    RedisModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        autoLogging: true,
        customProps: (req) => ({
          requestId: (req as { requestId?: string }).requestId,
        }),
        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
            }
          },
        },
      },
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ReceiptsModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
