import { neon } from '@neondatabase/serverless'
import { DATABASE_URL } from '$app/env/private'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema.js'

export type Database = ReturnType<typeof createDb>

function createDb(url: string) {
	return drizzle({ client: neon(url), schema })
}

let db: Database | undefined

/** Whether a database is configured. Without one, accounts are disabled. */
export const dbEnabled = !!DATABASE_URL

/** Drizzle client over Neon's serverless HTTP driver (pooled `DATABASE_URL`), created on first use */
export function getDb(): Database {
	if (!DATABASE_URL) throw new Error('DATABASE_URL is not set')
	return (db ??= createDb(DATABASE_URL))
}

export { schema }
