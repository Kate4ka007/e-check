import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createTestApp } from '../test/create-test-app'
import { disconnectTestPrisma, resetAuthData } from '../test/test-db'
import { ACCESS_COOKIE, REFRESH_COOKIE } from './cookie.service'

function uniquePassword(): string {
  return `Tst-${randomUUID().slice(0, 12)}!9Xk`
}

function parseSetCookie(
  setCookie: string | string[] | undefined,
  name: string,
): string | undefined {
  const headers = setCookie ? (Array.isArray(setCookie) ? setCookie : [setCookie]) : []
  const header = headers.find((value) => value.startsWith(`${name}=`))
  if (!header) return undefined
  return header.slice(name.length + 1).split(';')[0]
}

async function registerUser(
  app: INestApplication,
  overrides: Partial<{
    email: string
    password: string
    timezone: string
    baseCurrency: string
  }> = {},
) {
  const body = {
    email: overrides.email ?? `user-${randomUUID()}@example.com`,
    password: overrides.password ?? uniquePassword(),
    timezone: overrides.timezone ?? 'Europe/Minsk',
    baseCurrency: overrides.baseCurrency ?? 'BYN',
  }

  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send(body)
    .expect(201)

  return { body, profile: response.body as { id: string; email: string } }
}

describe('auth integration', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterEach(async () => {
    await resetAuthData()
  })

  afterAll(async () => {
    await app.close()
    await disconnectTestPrisma()
  })

  it('registers a user and sets auth cookies', async () => {
    const { body, profile } = await registerUser(app)

    expect(profile.email).toBe(body.email)
    expect(profile).toMatchObject({
      timezone: 'Europe/Minsk',
      baseCurrency: 'BYN',
      locale: 'ru',
      emailVerified: false,
    })
  })

  it('logs in with valid credentials and returns profile', async () => {
    const password = uniquePassword()
    const email = `login-${randomUUID()}@example.com`
    await registerUser(app, { email, password })

    const agent = request.agent(app.getHttpServer())
    const response = await agent.post('/api/v1/auth/login').send({ email, password }).expect(200)

    expect(response.body.email).toBe(email)

    const me = await agent.get('/api/v1/auth/me').expect(200)
    expect(me.body.email).toBe(email)
  })

  it('returns AUTH_INVALID_CREDENTIALS for wrong password', async () => {
    const password = uniquePassword()
    const email = `wrong-${randomUUID()}@example.com`
    await registerUser(app, { email, password })

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: `${password}x` })
      .expect(401)

    expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS')
  })

  it('rotates refresh token on refresh', async () => {
    const { body } = await registerUser(app)
    const agent = request.agent(app.getHttpServer())

    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200)

    const refreshBefore = parseSetCookie(login.headers['set-cookie'], REFRESH_COOKIE)
    expect(refreshBefore).toBeTruthy()

    const refreshed = await agent.post('/api/v1/auth/refresh').expect(200)
    const refreshAfter = parseSetCookie(refreshed.headers['set-cookie'], REFRESH_COOKIE)

    expect(refreshAfter).toBeTruthy()
    expect(refreshAfter).not.toBe(refreshBefore)
    expect(refreshed.body.email).toBe(body.email)

    await agent.get('/api/v1/auth/me').expect(200)
  })

  it('revokes the whole session family when a spent refresh token is reused', async () => {
    const { body } = await registerUser(app)
    const agent = request.agent(app.getHttpServer())

    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200)

    const spentRefresh = parseSetCookie(login.headers['set-cookie'], REFRESH_COOKIE)
    expect(spentRefresh).toBeTruthy()

    const rotated = await agent.post('/api/v1/auth/refresh').expect(200)
    const currentRefresh = parseSetCookie(rotated.headers['set-cookie'], REFRESH_COOKIE)
    expect(currentRefresh).toBeTruthy()
    expect(currentRefresh).not.toBe(spentRefresh)

    const reuse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${spentRefresh}`)
      .expect(401)

    expect(reuse.body.code).toBe('AUTH_SESSION_REVOKED')

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${currentRefresh}`)
      .expect(401)
  })

  it('logs out and clears the session', async () => {
    const { body } = await registerUser(app)
    const agent = request.agent(app.getHttpServer())

    await agent
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200)

    await agent.post('/api/v1/auth/logout').expect(204)
    await agent.get('/api/v1/auth/me').expect(401)

    const refresh = await agent.post('/api/v1/auth/refresh').expect(401)
    expect(refresh.body.code).toBe('AUTH_SESSION_EXPIRED')
  })

  it('rejects /auth/me without access cookie', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401)
    expect(response.body.code).toBe('AUTH_UNAUTHENTICATED')
  })

  it('returns AUTH_EMAIL_TAKEN for duplicate registration', async () => {
    const email = `dup-${randomUUID()}@example.com`
    const password = uniquePassword()
    await registerUser(app, { email, password })

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: uniquePassword(),
        timezone: 'Europe/Minsk',
        baseCurrency: 'BYN',
      })
      .expect(409)

    expect(response.body.code).toBe('AUTH_EMAIL_TAKEN')
  })
})

describe('auth integration — access token', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterEach(async () => {
    await resetAuthData()
  })

  afterAll(async () => {
    await app.close()
    await disconnectTestPrisma()
  })

  it('accepts access cookie on protected routes after login', async () => {
    const { body } = await registerUser(app)

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(200)

    const accessToken = parseSetCookie(login.headers['set-cookie'], ACCESS_COOKIE)
    expect(accessToken).toBeTruthy()

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `${ACCESS_COOKIE}=${accessToken}`)
      .expect(200)
  })
})
