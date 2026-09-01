import { execSync } from 'node:child_process'
import { readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const pidFile = join(import.meta.dirname, '.worker.pid')

export default async function globalTeardown() {
  if (process.env.E2E_EXTERNAL_SERVERS === '1') {
    return
  }

  try {
    const pid = readFileSync(pidFile, 'utf8').trim()
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' })
    } else {
      process.kill(Number(pid), 'SIGTERM')
    }
    unlinkSync(pidFile)
  } catch {
    // worker already stopped
  }
}
