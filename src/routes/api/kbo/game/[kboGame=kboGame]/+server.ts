import { cacheControlForKboGame, getKboGame, KboNotFoundError } from '#lib/server/kbo.js'
import type { RequestHandler } from './$types'

function error(status: number, message: string) {
	return Response.json(
		{ message },
		{ status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
	)
}

/**
 * A KBO game parsed from koreabaseball.com, for the game page to poll while it's live. Cached at
 * the CDN, and in memory per game (see `getKboGame`), so koreabaseball.com sees about one request
 * per half minute.
 */
export const GET: RequestHandler = async ({ params }) => {
	try {
		const game = await getKboGame(params.kboGame)
		return Response.json(game, {
			headers: { 'Cache-Control': cacheControlForKboGame(game), 'X-Robots-Tag': 'noindex' },
		})
	} catch (e) {
		if (e instanceof KboNotFoundError) return error(404, e.message)
		if (e instanceof Error && e.name === 'TimeoutError') {
			return error(504, 'koreabaseball.com did not respond in time.')
		}
		return error(502, `Could not load the KBO game (${e instanceof Error ? e.message : e}).`)
	}
}
