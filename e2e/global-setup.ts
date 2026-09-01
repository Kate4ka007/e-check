import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = join(import.meta.dirname, '..')
const pidFile = join(import.meta.dirname, '.worker.pid')

export default async function globalSetup() {
  if (process.env.E2E_EXTERNAL_SERVERS === '1') {
    return
  }

  const worker = spawn('pnpm', ['dev:worker'], {
    cwd: rootDir,
    env: { ...process.env, EXTRACTOR_KIND: 'mock' },
    stdio: 'pipe',
    shell: true,
  })

  writeFileSync(pidFile, String(worker.pid))

  await new Promise((resolve) => setTimeout(resolve, 2_000))
}
