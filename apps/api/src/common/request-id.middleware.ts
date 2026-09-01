import { Injectable, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'
import { runWithRequestContext } from './request-context'

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id')
    const requestId = incoming && incoming.length > 0 ? incoming : randomUUID()

    res.setHeader('X-Request-Id', requestId)
    req.requestId = requestId

    runWithRequestContext({ requestId }, () => next())
  }
}
