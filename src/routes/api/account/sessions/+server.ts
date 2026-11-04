import { error } from '@sveltejs/kit'
import { listSessions, revokeOtherSessions } from '#lib/server/account.js'
import { privateJson, readJson, requireUser } from '#lib/server/guard.js'
import type { RequestHandler } from './$types'

/** Signed-in devices for the session user */
export const GET: RequestHandler = async (event) => {
	const user = requireUser(event)
	const current = event.locals.session
	if (!current) error(401, 'Not signed in')

	return privateJson(await listSessions(user.id, current.id))
}

/** Sign out all other devices (keeps this one) */
export const DELETE: RequestHandler = async (event) => {
	const user = requireUser(event)
	const current = event.locals.session
	if (!current) error(401, 'Not signed in')
	await readJson(event) // same-origin JSON only

	await revokeOtherSessions(user.id, current.id)
	return privateJson(await listSessions(user.id, current.id))
}
