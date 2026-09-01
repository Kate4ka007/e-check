import { ApiError, type ApiErrorCode } from '@receipt-tracker/contracts'
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'
import { ZodValidationException } from 'nestjs-zod'
import type { ZodError } from 'zod'
import { getRequestId } from './request-context'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const requestId = getRequestId() ?? 'unknown'

    if (exception instanceof ApiError) {
      response.status(exception.status).json({
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId,
      })
      return
    }

    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as ZodError
      const details: Record<string, string[]> = {}

      for (const issue of zodError.issues) {
        const path = issue.path.join('.') || '_root'
        details[path] ??= []
        details[path].push(issue.message)
      }

      response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details,
        requestId,
      })
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const payload = exception.getResponse()
      const message =
        typeof payload === 'string'
          ? payload
          : typeof payload === 'object' && payload && 'message' in payload
            ? String((payload as { message: unknown }).message)
            : 'Request failed'

      response.status(status).json({
        code: status === HttpStatus.NOT_FOUND ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        message,
        requestId,
      })
      return
    }

    this.logger.error(exception)
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      requestId,
    })
  }
}

export function throwApiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: Record<string, string[]>,
): never {
  throw new ApiError(code, message, status, details)
}
