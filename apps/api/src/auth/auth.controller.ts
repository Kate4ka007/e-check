import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common'
import { ApiError, type UserProfile } from '@receipt-tracker/contracts'
import type { Request, Response } from 'express'
import { LoginRequestSchema, RegisterRequestSchema } from '@receipt-tracker/contracts'
import { AuthGuard } from './auth.guard'
import { AuthService } from './auth.service'
import { CookieService, REFRESH_COOKIE } from './cookie.service'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: CookieService,
  ) {}

  @Post('register')
  async register(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserProfile> {
    const input = RegisterRequestSchema.parse(body)
    const user = await this.auth.register(input)
    const tokens = await this.auth.issueTokens(user, req.header('user-agent') ?? undefined, req.ip)
    this.cookies.setAuthCookies(res, tokens.accessToken, tokens.refreshToken)
    return tokens.profile
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserProfile> {
    const input = LoginRequestSchema.parse(body)
    const user = await this.auth.login(input.email, input.password, req.ip ?? 'unknown')
    const tokens = await this.auth.issueTokens(user, req.header('user-agent') ?? undefined, req.ip)
    this.cookies.setAuthCookies(res, tokens.accessToken, tokens.refreshToken)
    return tokens.profile
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserProfile> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE]
    if (!refreshToken) {
      throw new ApiError('AUTH_SESSION_EXPIRED', 'Session expired', 401)
    }

    const tokens = await this.auth.refresh(
      refreshToken,
      req.header('user-agent') ?? undefined,
      req.ip,
    )
    this.cookies.setAuthCookies(res, tokens.accessToken, tokens.refreshToken)
    return tokens.profile
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE])
    this.cookies.clearAuthCookies(res)
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: Request): Promise<UserProfile> {
    const user = await this.auth.getUserById(req.userId!)
    return this.auth.toProfile(user)
  }
}
