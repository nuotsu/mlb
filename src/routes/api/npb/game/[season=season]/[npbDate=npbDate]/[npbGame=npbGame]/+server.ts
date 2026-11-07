import { cacheControlForNpbGame, getNpbGame, npbGameRef } from '#lib/server/npb-game-response.js'
import { NpbNotFoundError } from '#lib/server/npb.js'
import type { RequestHandler } from './$types'

function error(status: number, message: string) {
	return Response.json(
		{ message },
		{ status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
	)
}

/**
 * An NPB game parsed from npb.jp, for the game page to poll while it's live. Cached at the CDN,
 * and in memory per game (see `getNpbGame`), so npb.jp sees about one request per half minute.
 */
export const GET: RequestHandler = async ({ params }) => {
	try {
		const game = await getNpbGame(npbGameRef(params))
		return Response.json(game, {
			headers: { 'Cache-Control': cacheControlForNpbGame(game), 'X-Robots-Tag': 'noindex' },
		})
	} catch (e) {
		if (e instanceof NpbNotFoundError) return error(404, e.message)
		if (e instanceof Error && e.name === 'TimeoutError') {
			return error(504, 'npb.jp did not respond in time.')
		}
		return error(502, `Could not load the NPB game (${e instanceof Error ? e.message : e}).`)
	}
}
