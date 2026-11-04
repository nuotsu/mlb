import { MAX_FAVORITES, sanitizeFavorite, sanitizeSettings } from '#lib/account.js'
import { syncAccountState } from '#lib/server/account.js'
import { privateJson, readJson, requireUser } from '#lib/server/guard.js'
import type { RequestHandler } from './$types'

/** Sign-in merge: union local favorites into the account, newest settings win */
export const POST: RequestHandler = async (event) => {
	const user = requireUser(event)
	const body = (await readJson(event)) as Record<string, unknown> | null

	const favorites = (Array.isArray(body?.favorites) ? body.favorites : [])
		.slice(0, MAX_FAVORITES)
		.map(sanitizeFavorite)
		.filter((f) => f !== null)
	const settingsUpdatedAt = Number(body?.settingsUpdatedAt)

	const merged = await syncAccountState(user.id, {
		favorites,
		settings: sanitizeSettings(body?.settings),
		settingsUpdatedAt: Number.isFinite(settingsUpdatedAt) ? settingsUpdatedAt : 0,
	})

	return privateJson(merged)
}
