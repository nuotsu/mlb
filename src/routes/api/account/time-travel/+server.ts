import { error } from '@sveltejs/kit'
import { isGamePk, sanitizeMoment } from '#lib/account.js'
import { forgetMoment, saveMoment } from '#lib/server/account.js'
import { readJson, requireUser } from '#lib/server/guard.js'
import type { RequestHandler } from './$types'

const noContent = () =>
	new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } })

/** Save a game's time-travel moment: `{ gamePk, at, savedAt }`. Older moments are ignored. */
export const PUT: RequestHandler = async (event) => {
	const user = requireUser(event)
	const body = (await readJson(event)) as Record<string, unknown> | null
	const gamePk = String(body?.gamePk ?? '')
	const moment = sanitizeMoment(body)
	if (!isGamePk(gamePk) || !moment) error(400, 'Invalid moment')

	await saveMoment(user.id, gamePk, moment)
	return noContent()
}

/** Forget a game's moment (it went live): `{ gamePk }` */
export const DELETE: RequestHandler = async (event) => {
	const user = requireUser(event)
	const body = (await readJson(event)) as Record<string, unknown> | null
	const gamePk = String(body?.gamePk ?? '')
	if (!isGamePk(gamePk)) error(400, 'Invalid game')

	await forgetMoment(user.id, gamePk)
	return noContent()
}
