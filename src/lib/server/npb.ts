import { getScheduleToday } from '#lib/cache-control.js'
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

const MINUTE_MS = 60_000
/** Matches `cacheControlForSeasonPage`: 15 min for the current season, a week for past ones. */
const CURRENT_SEASON_TTL_MS = 15 * MINUTE_MS
const PAST_SEASON_TTL_MS = 7 * 24 * 60 * MINUTE_MS
/** npb.jp has ~20 seasons; the cap only guards against a flood of odd season params. */
const MAX_CACHED_SEASONS = 50

const cache = new Map<number, { expires: number; standings: Promise<NpbLeagueStandings[]> }>()

/**
 * {@link fetchNpbStandings}, cached in memory per season and shared by concurrent callers.
 *
 * Page renders call the API route in-process, which skips the CDN, so every uncached page URL
 * (`?league=`, `?sort=`, …) would otherwise hit npb.jp. Failed fetches aren't kept, except
 * {@link NpbNotFoundError}, which won't change within the TTL.
 */
export function getNpbStandings(
	season: number,
	{
		fetcher = fetch,
		now = Date.now(),
		currentSeason = getScheduleToday().getFullYear(),
	}: { fetcher?: typeof fetch; now?: number; currentSeason?: number } = {},
): Promise<NpbLeagueStandings[]> {
	const hit = cache.get(season)
	if (hit && hit.expires > now) return hit.standings

	const standings = fetchNpbStandings(season, fetcher)
	const ttl = season < currentSeason ? PAST_SEASON_TTL_MS : CURRENT_SEASON_TTL_MS

	cache.delete(season)
	if (cache.size >= MAX_CACHED_SEASONS) cache.delete(cache.keys().next().value!)
	cache.set(season, { expires: now + ttl, standings })

	standings.catch((e) => {
		if (!(e instanceof NpbNotFoundError) && cache.get(season)?.standings === standings) {
			cache.delete(season)
		}
	})

	return standings
}

/** For tests. */
export function clearNpbStandingsCache() {
	cache.clear()
}
