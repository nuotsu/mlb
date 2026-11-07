import {
	NPB_LEAGUES,
	NPB_MIN_SEASON,
	npbStandingsUrl,
	parseNpbStandings,
	type NpbLeagueId,
	type NpbLeagueStandings,
} from '#lib/npb.js'

const UPSTREAM_TIMEOUT_MS = 10_000

export class NpbNotFoundError extends Error {}

/**
 * Fetches and parses both leagues' standings for a season from npb.jp.
 * Throws {@link NpbNotFoundError} when npb.jp has no page for that season.
 */
export async function fetchNpbStandings(
	season: number,
	fetcher: typeof fetch = fetch,
): Promise<NpbLeagueStandings[]> {
	if (season < NPB_MIN_SEASON) throw new NpbNotFoundError(`npb.jp has no standings for ${season}`)

	return Promise.all(
		(Object.keys(NPB_LEAGUES) as NpbLeagueId[]).map(async (league) => {
			const url = npbStandingsUrl(season, league)
			const response = await fetcher(url, {
				headers: { accept: 'text/html' },
				signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
			})

			if (response.status === 404) {
				throw new NpbNotFoundError(`npb.jp has no standings for ${season}`)
			}
			if (!response.ok) throw new Error(`${url} responded ${response.status}`)

			return parseNpbStandings(await response.text(), { season, league })
		}),
	)
}
