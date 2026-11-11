// Starts a throwaway in-memory MongoDB and the built app against it, for Playwright.
// Never touches the database in .env. Run `nuxt build` first (npm run test:e2e does).
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { MongoMemoryServer } from 'mongodb-memory-server'

const port = process.argv[2] ?? '3100'
const mongo = await MongoMemoryServer.create()
// Tests read this to set up states that take real time (an expired trial). Throwaway database only.
mkdirSync('node_modules/.cache', { recursive: true })
writeFileSync('node_modules/.cache/tingbits-e2e-db-uri', mongo.getUri('tingbits-e2e'))
const app = spawn(process.execPath, ['.output/server/index.mjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: port,
    HOST: '127.0.0.1',
    MONGODB_URI: '',
    NUXT_MONGODB_URI: mongo.getUri('tingbits-e2e'),
    NUXT_SESSION_PASSWORD: randomBytes(32).toString('base64url'),
    // Every test signs up from 127.0.0.1; the limiter stays on, with room for the whole suite.
    NUXT_AUTH_RATE_LIMIT: '1000',
  },
})
const stop = async () => { app.kill(); await mongo.stop(); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
app.on('exit', async (code) => { await mongo.stop(); process.exit(code ?? 0) })
