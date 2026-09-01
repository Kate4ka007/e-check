import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthGuard } from './auth.guard'
import { AuthService } from './auth.service'
import { CookieService } from './cookie.service'
import { PasswordService } from './password.service'
import { RateLimitService } from './rate-limit.service'
import { SessionService } from './session.service'

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    PasswordService,
    CookieService,
    RateLimitService,
    AuthGuard,
  ],
  exports: [AuthGuard, AuthService, SessionService],
})
export class AuthModule {}
