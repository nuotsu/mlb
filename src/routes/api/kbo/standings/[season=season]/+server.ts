import { cacheControlForSeasonPage } from '#lib/cache-control.js'
import { KBO_STANDINGS_URL } from '#lib/kbo.js'
import { getKboStandings, KboNotFoundError } from '#lib/server/kbo.js'
import type { RequestHandler } from './$types'

function error(status: number, message: string) {
	return Response.json(
		{ message },
		{ status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
	)
}

/**
 * KBO standings for a season, parsed from koreabaseball.com. Only the season it currently shows
 * is available. Cached at the CDN, and in memory (see `getKboStandings`), so koreabaseball.com
 * sees at most a few requests per cache window.
 */
export const GET: RequestHandler = async ({ params }) => {
	const season = Number(params.season)

	try {
		const standings = await getKboStandings(season)

		return Response.json(
			{ source: KBO_STANDINGS_URL, ...standings },
			{
				headers: {
					'Cache-Control': cacheControlForSeasonPage(season),
					'X-Robots-Tag': 'noindex',
				},
			},
		)
	} catch (e) {
		if (e instanceof KboNotFoundError) return error(404, e.message)
		if (e instanceof Error && e.name === 'TimeoutError') {
			return error(504, 'koreabaseball.com did not respond in time.')
		}

		return error(502, `Could not load KBO standings (${e instanceof Error ? e.message : e}).`)
	}
}
