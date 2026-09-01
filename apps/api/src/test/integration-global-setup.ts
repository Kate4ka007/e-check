import { execSync } from 'node:child_process'
import path from 'node:path'
import { applyIntegrationEnv } from './integration-env'

export default function setup() {
  applyIntegrationEnv()

  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../..'),
    env: process.env,
    stdio: 'inherit',
  })
}
