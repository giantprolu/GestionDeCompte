const { spawnSync } = require('child_process')

if (process.env.NODE_ENV !== 'development') {
  console.error('Tests can only be run in development mode. Set NODE_ENV=development and try again.')
  process.exit(1)
}

const result = spawnSync('npx', ['vitest', 'run'], { stdio: 'inherit', shell: true })
process.exit(result.status)
const { spawnSync } = require('child_process')

if (process.env.NODE_ENV !== 'development') {
  console.error('Tests can only be run in development. Set NODE_ENV=development and retry.')
  process.exit(1)
}

// Run vitest
const res = spawnSync('npx', ['vitest', ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(res.status)
