import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { ApiError } from '@receipt-tracker/contracts'
import { setRequestUserId } from '../common/request-context'
import { ACCESS_COOKIE } from './cookie.service'
import { SessionService } from './session.service'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const token = request.cookies?.[ACCESS_COOKIE]

    if (!token) {
      throw new ApiError('AUTH_UNAUTHENTICATED', 'Authentication required', 401)
    }

    try {
      const { userId } = this.sessions.verifyAccessToken(token)
      setRequestUserId(userId)
      request.userId = userId
      return true
    } catch {
      throw new ApiError('AUTH_SESSION_EXPIRED', 'Session expired', 401)
    }
  }
}
