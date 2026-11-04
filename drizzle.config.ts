import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit doesn't read env files; load them like Vite does (already-set variables win)
for (const file of ['.env.local', '.env']) {
	if (existsSync(file) && typeof process.loadEnvFile === 'function') process.loadEnvFile(file)
}

/*
	Migrations use the direct (unpooled) connection when available.
	Locally, point these at a Neon dev branch in `.env`, never at `main`.
*/
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL

// Show which database this will touch (host only, never the password)
if (url) console.log(`drizzle-kit target: ${new URL(url).host}`)

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: { url: url ?? '' },
	strict: true,
	verbose: true,
})
