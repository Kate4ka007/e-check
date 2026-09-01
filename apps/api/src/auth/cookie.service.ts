import { Inject, Injectable } from '@nestjs/common'
import type { Response } from 'express'
import { ENV } from '../config/config.module'
import type { Env } from '../config/env.schema'

export const ACCESS_COOKIE = 'access_token'
export const REFRESH_COOKIE = 'refresh_token'

@Injectable()
export class CookieService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const common = {
      httpOnly: true,
      secure: this.env.COOKIE_SECURE,
      sameSite: 'lax' as const,
      ...(this.env.COOKIE_DOMAIN ? { domain: this.env.COOKIE_DOMAIN } : {}),
    }

    res.cookie(ACCESS_COOKIE, accessToken, {
      ...common,
      path: '/',
      maxAge: this.env.jwtAccessTtlMs,
    })

    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...common,
      path: '/api/v1/auth/refresh',
      maxAge: this.env.refreshTtlMs,
    })
  }

  clearAuthCookies(res: Response) {
    const common = {
      httpOnly: true,
      secure: this.env.COOKIE_SECURE,
      sameSite: 'lax' as const,
      ...(this.env.COOKIE_DOMAIN ? { domain: this.env.COOKIE_DOMAIN } : {}),
    }

    res.clearCookie(ACCESS_COOKIE, { ...common, path: '/' })
    res.clearCookie(REFRESH_COOKIE, { ...common, path: '/api/v1/auth/refresh' })
  }
}
