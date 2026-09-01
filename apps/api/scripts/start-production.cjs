const { spawn } = require('node:child_process')

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

function startProcess(command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
  })

  child.on('error', (error) => {
    console.error(error)
    process.exit(1)
  })

  return child
}

async function main() {
  console.log('Running database migrations...')
  await run('npx', ['prisma', 'migrate', 'deploy'])

  console.log('Starting API and worker...')
  const children = [
    startProcess('node', ['dist/main.js']),
    startProcess('node', ['dist/worker.js']),
  ]

  let shuttingDown = false

  const shutdown = (signal) => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    console.log(`Shutting down (${signal})...`)

    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGTERM')
      }
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  const results = await Promise.race(
    children.map(
      (child) =>
        new Promise((resolve) => {
          child.on('exit', (code, signal) => resolve({ code, signal }))
        }),
    ),
  )

  shutdown('exit')

  if (results.signal) {
    process.exit(1)
  }

  process.exit(results.code ?? 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
