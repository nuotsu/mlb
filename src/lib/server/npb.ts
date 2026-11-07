import { getScheduleToday } from '#lib/cache-control.js'
import {
	buildNpbRoster,
	isNpbTeam,
	npbFieldingUrl,
	npbRosterUrl,
	parseNpbFielding,
	parseNpbRoster,
	type NpbFielding,
	type NpbRoster,
} from '#lib/npb-roster.js'
import {
	NPB_LEAGUES,
	NPB_MIN_SEASON,
	npbStandingsUrl,
	parseNpbStandings,
	type NpbLeagueId,
	type NpbLeagueStandings,
} from '#lib/npb.js'
import {
	createMemoryCache,
	CURRENT_SEASON_TTL_MS,
	PAST_SEASON_TTL_MS,
} from '#lib/server/memory-cache.js'

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

const cache = createMemoryCache<number, NpbLeagueStandings[]>({
	keepError: (e) => e instanceof NpbNotFoundError,
})

/**
 * {@link fetchNpbStandings}, cached in memory per season (see `createMemoryCache`).
 * {@link NpbNotFoundError} is kept for the TTL; other failures are retried on the next call.
 */
export function getNpbStandings(
	season: number,
	{
		fetcher = fetch,
		now = Date.now(),
		currentSeason = getScheduleToday().getFullYear(),
	}: { fetcher?: typeof fetch; now?: number; currentSeason?: number } = {},
): Promise<NpbLeagueStandings[]> {
	const ttl = season < currentSeason ? PAST_SEASON_TTL_MS : CURRENT_SEASON_TTL_MS
	return cache.get(season, ttl, () => fetchNpbStandings(season, fetcher), now)
}

/** For tests. */
export function clearNpbStandingsCache() {
	cache.clear()
}

/** GETs an npb.jp page's HTML, or throws {@link NpbNotFoundError} on a 404. */
async function fetchPage(url: string, fetcher: typeof fetch) {
	const response = await fetcher(url, {
		headers: { accept: 'text/html' },
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
	})

	if (response.status === 404) throw new NpbNotFoundError(`${url} not found`)
	if (!response.ok) throw new Error(`${url} responded ${response.status}`)

	return response.text()
}

/** For the extras: the roster still shows without Japanese names or exact positions. */
function optional<T>(label: string) {
	return (e: unknown): T | null => {
		console.warn(`[npbRoster] ${label}:`, e instanceof Error ? e.message : e)
		return null
	}
}

/**
 * Fetches a team's current roster from npb.jp (it publishes no past rosters): the English page,
 * plus the Japanese page and the season's first-team and farm fielding stats, merged by
 * `buildNpbRoster`. Only the English page is required.
 * Throws {@link NpbNotFoundError} for a team npb.jp has no roster for.
 */
export async function fetchNpbRoster(
	teamId: number,
	fetcher: typeof fetch = fetch,
): Promise<NpbRoster> {
	if (!isNpbTeam(teamId)) throw new NpbNotFoundError(`npb.jp has no roster for team ${teamId}`)

	const [en, ja] = await Promise.all([
		fetchPage(npbRosterUrl(teamId), fetcher).then(parseNpbRoster),
		fetchPage(npbRosterUrl(teamId, 'ja'), fetcher)
			.then(parseNpbRoster)
			.catch(optional<NpbRoster>('Japanese roster')),
	])

	// A new season's roster can be up before its first game, and so before any fielding stats
	const fielding = en.season
		? await Promise.all(
				([1, 2] as const).map((level) =>
					fetchPage(npbFieldingUrl(en.season!, teamId, level), fetcher)
						.then(parseNpbFielding)
						.catch(optional<NpbFielding>(`fielding ${level}`)),
				),
			)
		: []

	return buildNpbRoster({
		teamId,
		en,
		ja,
		fielding: fielding.filter((page) => page !== null),
	})
}

const rosterCache = createMemoryCache<number, NpbRoster>({
	keepError: (e) => e instanceof NpbNotFoundError,
})

/**
 * {@link fetchNpbRoster}, cached in memory per team for as long as a current season's standings.
 * {@link NpbNotFoundError} is kept for the TTL; other failures are retried on the next call.
 */
export function getNpbRoster(
	teamId: number,
	{ fetcher = fetch, now = Date.now() }: { fetcher?: typeof fetch; now?: number } = {},
): Promise<NpbRoster> {
	return rosterCache.get(teamId, CURRENT_SEASON_TTL_MS, () => fetchNpbRoster(teamId, fetcher), now)
}

/** For tests. */
export function clearNpbRosterCache() {
	rosterCache.clear()
}
