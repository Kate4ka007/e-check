import type { Request } from 'express'

declare global {
  namespace Express {
    interface Request {
      requestId?: string
      userId?: string
    }
  }
}

export {}
