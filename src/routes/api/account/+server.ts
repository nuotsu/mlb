import { getAccountState } from '#lib/server/account.js'
import { privateJson, requireUser } from '#lib/server/guard.js'
import type { RequestHandler } from './$types'

/** The signed-in user's favorites and settings */
export const GET: RequestHandler = async (event) => {
	const user = requireUser(event)
	return privateJson(await getAccountState(user.id))
}
