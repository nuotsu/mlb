import { getScheduleToday } from '#lib/cache-control.js'
import { KBO_STANDINGS_URL, parseKboStandings, type KboStandings } from '#lib/kbo.js'
import { createMemoryCache, CURRENT_SEASON_TTL_MS } from '#lib/server/memory-cache.js'

const UPSTREAM_TIMEOUT_MS = 10_000

export class KboNotFoundError extends Error {}

/** Fetches and parses the latest standings koreabaseball.com publishes. */
export async function fetchLatestKboStandings(
	fetcher: typeof fetch = fetch,
): Promise<KboStandings> {
	const response = await fetcher(KBO_STANDINGS_URL, {
		headers: { accept: 'text/html' },
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
	})

	if (!response.ok) throw new Error(`${KBO_STANDINGS_URL} responded ${response.status}`)

	return parseKboStandings(await response.text())
}

/** One page, so one key; it changes daily during the season. */
const cache = createMemoryCache<'latest', KboStandings>({ max: 1 })

/**
 * KBO standings for a season, cached in memory (see `createMemoryCache`) so koreabaseball.com
 * sees at most one request per cache window per server instance.
 *
 * Only the season koreabaseball.com currently shows is available; any other season throws
 * {@link KboNotFoundError}.
 */
export async function getKboStandings(
	season: number,
	{ fetcher = fetch, now = Date.now() }: { fetcher?: typeof fetch; now?: number } = {},
): Promise<KboStandings> {
	// koreabaseball.com only shows the latest season, which is never past this year
	if (season > getScheduleToday().getFullYear()) {
		throw new KboNotFoundError(`No KBO standings for ${season}`)
	}

	const standings = await cache.get(
		'latest',
		CURRENT_SEASON_TTL_MS,
		() => fetchLatestKboStandings(fetcher),
		now,
	)

	if (standings.season !== season) {
		throw new KboNotFoundError(
			`KBO standings are only available for the ${standings.season} season, not ${season}`,
		)
	}

	return standings
}

/** For tests. */
export function clearKboStandingsCache() {
	cache.clear()
}
