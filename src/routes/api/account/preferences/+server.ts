import { sanitizeSettings } from '#lib/account.js'
import { saveSettings } from '#lib/server/account.js'
import { privateJson, readJson, requireUser } from '#lib/server/guard.js'
import type { RequestHandler } from './$types'

/** Replace settings: `{ settings, updatedAt }`. Older writes are ignored (newest wins). */
export const PUT: RequestHandler = async (event) => {
	const user = requireUser(event)
	const body = (await readJson(event)) as Record<string, unknown> | null
	const updatedAt = Number(body?.updatedAt)

	const state = await saveSettings(
		user.id,
		sanitizeSettings(body?.settings),
		Number.isFinite(updatedAt) ? updatedAt : Date.now(),
	)

	return privateJson(state)
}
