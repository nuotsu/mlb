import { getScheduleToday } from '#lib/cache-control.js'
import {
	npbGameUrl,
	parseNpbBox,
	parseNpbCancelReason,
	parseNpbGame,
	parseNpbPlays,
	type NpbGame,
	type NpbGameData,
	type NpbGamePlayerName,
	type NpbGameRef,
} from '#lib/npb-game.js'
import {
	buildNpbRoster,
	isNpbTeam,
	NPB_TEAM_INFO,
	npbFieldingUrl,
	npbRosterUrl,
	parseNpbFielding,
	parseNpbRoster,
	type NpbFielding,
	type NpbRoster,
} from '#lib/npb-roster.js'
import {
	buildNpbSchedule,
	NPB_POSTSEASON_MONTHS,
	NPB_SCHEDULE_MIN_SEASON,
	NPB_SCHEDULE_MONTHS,
	npbCalendarUrl,
	npbScheduleUrl,
	parseNpbPostseason,
	parseNpbScheduleMonth,
	toNpbScheduleLinescore,
	type NpbPostseason,
	type NpbSchedule,
	type NpbScheduleGame,
	type NpbScheduleLinescore,
} from '#lib/npb-schedule.js'
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

export type { NpbGameData, NpbGamePlayerName }

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

/** Regular season, interleague, postseason and All-Star games; exhibitions aren't covered */
const isCoveredCompetition = (competitionJa: string | null) =>
	!competitionJa || /公式戦|交流戦|CS|クライマックス|日本シリーズ|オールスター/.test(competitionJa)

/** English names for the players on a team's current roster, if it's the game's season */
function rosterNames(roster: NpbRoster | null, season: number) {
	const names: Record<string, NpbGamePlayerName> = {}
	if (!roster || roster.season !== season) return names

	const split = roster.players.map((player) => {
		const [last = player.name, first = ''] = player.name.split(',').map((part) => part.trim())
		return { player, last, first }
	})
	const surnames = new Map<string, number>()
	for (const { last } of split) surnames.set(last, (surnames.get(last) ?? 0) + 1)

	for (const { player, last, first } of split) {
		names[player.id] = {
			short: surnames.get(last)! > 1 && first ? `${first[0]}. ${last}` : last,
			full: first ? `${first} ${last}` : last,
			photo: player.photo,
		}
	}

	return names
}

/**
 * Fetches and parses an NPB game from npb.jp: the TOP page (required), then its box score and
 * play-by-play once the game has started, plus English names from both teams' rosters.
 * Throws {@link NpbNotFoundError} when npb.jp has no such game, or it's not a regular season one.
 */
export async function fetchNpbGame(
	ref: NpbGameRef,
	fetcher: typeof fetch = fetch,
): Promise<NpbGameData> {
	const game = parseNpbGame(await fetchPage(npbGameUrl(ref), fetcher), ref)

	if (!isCoveredCompetition(game.competitionJa)) {
		throw new NpbNotFoundError(`${game.competitionJa} games aren't covered`)
	}

	const started = game.state !== 'Preview' && !game.isCancelled

	const [box, plays, ...rosters] = await Promise.all([
		started
			? fetchPage(npbGameUrl(ref, 'box'), fetcher)
					.then(parseNpbBox)
					.catch(optional<NpbGame['box']>('box score'))
			: null,
		started
			? fetchPage(npbGameUrl(ref, 'playbyplay'), fetcher)
					.then(parseNpbPlays)
					.catch(optional<NpbGame['plays']>('play-by-play'))
			: null,
		// An All-Star side's players come from every team in its league, so read every roster
		...[
			...new Set(
				(['away', 'home'] as const).flatMap((side) => {
					const id = game.teams[side].id
					return id && isNpbTeam(id) ? [id] : Object.keys(NPB_TEAM_INFO).map(Number)
				}),
			),
		].map((id) => getNpbRoster(id, { fetcher }).catch(optional<NpbRoster>(`roster ${id}`))),
	])

	return {
		...game,
		box,
		plays,
		names: Object.assign({}, ...rosters.map((roster) => rosterNames(roster, ref.season))),
	}
}

const LIVE_GAME_TTL_MS = 30_000

const gameCache = createMemoryCache<string, NpbGameData>({
	keepError: (e) => e instanceof NpbNotFoundError,
})

/**
 * {@link fetchNpbGame}, cached in memory: briefly for games from yesterday on (which may be live
 * or about to be), and like a past season's standings for older ones.
 */
export function getNpbGame(
	ref: NpbGameRef,
	{
		fetcher = fetch,
		now = Date.now(),
		today = getScheduleToday(),
	}: { fetcher?: typeof fetch; now?: number; today?: Date } = {},
): Promise<NpbGameData> {
	const ttl = isRecentNpbGame(ref, today) ? LIVE_GAME_TTL_MS : PAST_SEASON_TTL_MS
	const key = `${ref.season}/${ref.date}/${ref.code}`
	return gameCache.get(key, ttl, () => fetchNpbGame(ref, fetcher), now)
}

/** From the day before `today` on: such a game may still change */
export function isRecentNpbGame({ season, date }: NpbGameRef, today: Date) {
	const game = Date.UTC(season, Number(date.slice(0, 2)) - 1, Number(date.slice(2)))
	const yesterday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 1)
	return game >= yesterday
}

/** For tests. */
export function clearNpbGameCache() {
	gameCache.clear()
}

/** A month npb.jp has no page for (before opening day, after the season) has no games */
const orNothing = <T>(e: unknown): T | null => {
	if (e instanceof NpbNotFoundError) return null
	throw e
}

/**
 * Fetches a season's regular season schedule from npb.jp: every month's detail page, plus the
 * English calendar for the months the postseason can fall in, to leave it out.
 * Throws {@link NpbNotFoundError} when npb.jp has no schedule for that season.
 */
export async function fetchNpbSchedule(
	season: number,
	fetcher: typeof fetch = fetch,
): Promise<NpbSchedule> {
	if (season < NPB_SCHEDULE_MIN_SEASON) {
		throw new NpbNotFoundError(`npb.jp has no schedule for ${season}`)
	}

	const [months, calendars] = await Promise.all([
		Promise.all(
			NPB_SCHEDULE_MONTHS.map((month) =>
				fetchPage(npbScheduleUrl(season, month), fetcher)
					.then((html) => parseNpbScheduleMonth(html, season))
					.catch(orNothing<ReturnType<typeof parseNpbScheduleMonth>>),
			),
		),
		Promise.all(
			NPB_POSTSEASON_MONTHS.map((month) =>
				fetchPage(npbCalendarUrl(season, month), fetcher)
					.then((html) => parseNpbPostseason(html, season, month))
					.catch(orNothing<NpbPostseason>),
			),
		),
	])

	const found = months.filter((month) => month !== null)
	if (!found.length) throw new NpbNotFoundError(`npb.jp has no schedule for ${season}`)

	return buildNpbSchedule({
		season,
		months: found,
		postseason: {
			start: calendars.find((calendar) => calendar?.start)?.start ?? null,
			games: new Map(calendars.flatMap((calendar) => [...(calendar?.games ?? [])])),
		},
		today: japanToday(),
	})
}

const scheduleCache = createMemoryCache<number, NpbSchedule>({
	keepError: (e) => e instanceof NpbNotFoundError,
})

/**
 * {@link fetchNpbSchedule}, cached in memory per season like the standings: briefly for the
 * current season, for a week for past ones.
 */
export function getNpbSchedule(
	season: number,
	{
		fetcher = fetch,
		now = Date.now(),
		currentSeason = getScheduleToday().getFullYear(),
	}: { fetcher?: typeof fetch; now?: number; currentSeason?: number } = {},
): Promise<NpbSchedule> {
	const ttl = season < currentSeason ? PAST_SEASON_TTL_MS : CURRENT_SEASON_TTL_MS
	return scheduleCache.get(season, ttl, () => fetchNpbSchedule(season, fetcher), now)
}

/** For tests. */
export function clearNpbScheduleCache() {
	scheduleCache.clear()
}

const linescoreCache = createMemoryCache<string, NpbScheduleLinescore>({
	max: 500,
	keepError: (e) => e instanceof NpbNotFoundError,
})

/**
 * A game's state and linescore from its TOP page alone (no box score, plays or rosters), for the
 * schedule pages. Cached like {@link getNpbGame}.
 */
export function getNpbScheduleLinescore(
	ref: NpbGameRef,
	{
		fetcher = fetch,
		now = Date.now(),
		today = getScheduleToday(),
	}: { fetcher?: typeof fetch; now?: number; today?: Date } = {},
): Promise<NpbScheduleLinescore> {
	const ttl = isRecentNpbGame(ref, today) ? LIVE_GAME_TTL_MS : PAST_SEASON_TTL_MS
	const key = `${ref.season}/${ref.date}/${ref.code}`
	return linescoreCache.get(
		key,
		ttl,
		async () => {
			const html = await fetchPage(npbGameUrl(ref), fetcher)
			return toNpbScheduleLinescore(parseNpbGame(html, ref), parseNpbCancelReason(html))
		},
		now,
	)
}

/** For tests. */
export function clearNpbScheduleLinescoreCache() {
	linescoreCache.clear()
}

/** At most this many npb.jp game pages are read at once */
const LINESCORE_CONCURRENCY = 6

/** Today's date in Japan, where NPB's games are dated */
export const japanToday = () =>
	new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())

/**
 * `games` with their `linescore` from each game's own page: games from today (in Japan) back, as
 * later ones have none yet; called-off ones for the reason. A page that can't be read leaves `null`.
 */
export async function withNpbScheduleLinescores(
	games: NpbScheduleGame[],
	{ fetcher = fetch, today = japanToday() }: { fetcher?: typeof fetch; today?: string } = {},
): Promise<NpbScheduleGame[]> {
	const result = games.map((game) => ({ ...game }))
	const queue = result.filter((game) => game.date <= today)

	async function worker() {
		for (let game = queue.shift(); game; game = queue.shift()) {
			game.linescore = await getNpbScheduleLinescore(game.ref, { fetcher }).catch(
				optional<NpbScheduleLinescore>(`linescore ${game.ref.date}/${game.ref.code}`),
			)
		}
	}

	await Promise.all(Array.from({ length: LINESCORE_CONCURRENCY }, worker))
	return result
}
