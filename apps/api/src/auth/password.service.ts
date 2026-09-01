import { Injectable } from '@nestjs/common'
import { hash, verify } from '@node-rs/argon2'
import { ApiError } from '@receipt-tracker/contracts'
import { createHash } from 'node:crypto'

@Injectable()
export class PasswordService {
  private readonly options = {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  }

  async hashPassword(password: string): Promise<string> {
    return hash(password, this.options)
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return verify(passwordHash, password, this.options)
  }

  assertStrongEnough(password: string): void {
    if (password.length < 10) {
      throw new ApiError('AUTH_PASSWORD_TOO_WEAK', 'Password is too weak', 422)
    }
  }

  async assertNotPwned(password: string): Promise<void> {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
    const prefix = sha1.slice(0, 5)
    const suffix = sha1.slice(5)

    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!response.ok) return

      const body = await response.text()
      const leaked = body.split('\n').some((line) => line.startsWith(suffix))
      if (leaked) {
        throw new ApiError('AUTH_PASSWORD_TOO_WEAK', 'Password is too weak', 422)
      }
    } catch (error) {
      if (error instanceof ApiError) throw error
      // Сеть недоступна — не блокируем регистрацию локально.
    }
  }
}
