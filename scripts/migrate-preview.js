/*
	Runs before `vite build`. On Vercel preview deployments only, applies Drizzle migrations to
	the preview's own Neon branch (the Neon integration creates one per git branch from `main`,
	so it starts without the app's tables). Production and local builds skip this: migrate
	production by hand.
*/
import { spawnSync } from 'node:child_process'

/** Never migrate this endpoint automatically (production `main` branch) */
const PRODUCTION_ENDPOINT = 'ep-odd-surf-bb4yx2m2'

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL

if (process.env.VERCEL_ENV !== 'preview') {
	process.exit(0)
}

if (!url) {
	console.log('[migrate-preview] No DATABASE_URL on this preview; skipping migrations')
	process.exit(0)
}

const host = new URL(url).host
if (host.startsWith(PRODUCTION_ENDPOINT)) {
	// Fail loudly: a preview pointed at production means the Neon preview branching is off
	console.error(`[migrate-preview] Refusing to migrate production (${host}) from a preview build`)
	process.exit(1)
}

console.log(`[migrate-preview] Migrating preview database ${host}`)
const result = spawnSync('node_modules/.bin/drizzle-kit', ['migrate'], { stdio: 'inherit' })
process.exit(result.status ?? 1)
