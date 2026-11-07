import { cacheControlForSeasonPage } from '#lib/cache-control.js'
import { fetchNpbStandings, NpbNotFoundError } from '#lib/server/npb.js'
import type { RequestHandler } from './$types'

function error(status: number, message: string) {
	return Response.json(
		{ message },
		{ status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
	)
}

/**
 * NPB (Central and Pacific League) standings for a season, parsed from npb.jp.
 * Cached at the CDN so npb.jp sees at most a few requests per season page per cache window.
 */
export const GET: RequestHandler = async ({ params, fetch }) => {
	const season = Number(params.season)

	try {
		const leagues = await fetchNpbStandings(season, fetch)

		return Response.json(
			{ season, source: 'https://npb.jp/bis/', leagues },
			{
				headers: {
					'Cache-Control': cacheControlForSeasonPage(season),
					'X-Robots-Tag': 'noindex',
				},
			},
		)
	} catch (e) {
		if (e instanceof NpbNotFoundError) return error(404, e.message)
		if (e instanceof Error && e.name === 'TimeoutError') {
			return error(504, 'npb.jp did not respond in time.')
		}

		return error(502, `Could not load NPB standings (${e instanceof Error ? e.message : e}).`)
	}
}
