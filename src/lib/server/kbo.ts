import { cacheControlForGame, getScheduleToday } from '#lib/cache-control.js'
import {
	decisionRecord,
	kboGameCenterUrl,
	kboPlays,
	noteNames,
	parseKboBoxScore,
	parseKboGameId,
	parseKboGameList,
	parseKboHomeRuns,
	parseKboScoreboard,
	type KboBox,
	type KboBoxScoreResponse,
	type KboDecision,
	type KboGame,
	type KboGameListItem,
	type KboGameSummary,
	type KboGameTeam,
	type KboPlayerRef,
	type KboScoreboard,
	type KboScoreboardResponse,
	type KboSide,
} from '#lib/kbo-game.js'
import {
	KBO_REGISTER_URL,
	kboRegisterForm,
	kboRegisterPostback,
	parseKboRegister,
	type KboRoster,
} from '#lib/kbo-roster.js'
import {
	buildKboSchedule,
	KBO_ALL_STAR_MONTH,
	KBO_POSTSEASON_MONTHS,
	KBO_SCHEDULE_MIN_SEASON,
	KBO_SCHEDULE_MONTHS,
	KBO_SCHEDULE_SERIES,
	parseKboAllStar,
	parseKboScheduleList,
	type KboSchedule,
	type KboScheduleGame,
	type KboScheduleRow,
} from '#lib/kbo-schedule.js'
import {
	isKboTeam,
	KBO_STANDINGS_URL,
	kboTeamByCode,
	kboTeamById,
	parseKboStandings,
	type KboGridTable,
	type KboStandings,
	type KboTeamInfo,
} from '#lib/kbo.js'
import {
	createMemoryCache,
	CURRENT_SEASON_TTL_MS,
	PAST_SEASON_TTL_MS,
} from '#lib/server/memory-cache.js'

/*
 * Shipping this needs KBO's prior approval: koreabaseball.com's robots.txt disallows generic
 * agents, and its terms prohibit automated collection of its data without approval.
 */

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

/* -------------------------------------------------------------------------------------------- */
/* Schedule, games and rosters                                                                   */
/* -------------------------------------------------------------------------------------------- */

const KBO_URL = 'https://www.koreabaseball.com'

/** Today's date in Korea, where KBO's games are dated */
export const koreaToday = () =>
	new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())

/**
 * POSTs to one of koreabaseball.com's web services (`/ws/*.asmx`) as its own pages do: it answers
 * with an error page unless the request comes from one of them (`Referer`).
 */
async function postKbo<T>(
	path: string,
	params: Record<string, string | number>,
	referer: string,
	fetcher: typeof fetch,
): Promise<T> {
	const url = `${KBO_URL}${path}`
	const response = await fetcher(url, {
		method: 'POST',
		headers: {
			accept: 'application/json, text/javascript, */*; q=0.01',
			'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
			referer,
			'x-requested-with': 'XMLHttpRequest',
		},
		body: new URLSearchParams(
			Object.entries(params).map(([key, value]) => [key, String(value)]),
		).toString(),
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
	})

	if (!response.ok) throw new Error(`${url} responded ${response.status}`)

	const text = (await response.text()).replace(/^﻿/, '')
	if (!/^\s*[[{]/.test(text)) throw new Error(`${url} answered with an error page`)
	return JSON.parse(text) as T
}

const SCHEDULE_PAGE = `${KBO_URL}/Schedule/Schedule.aspx`
const GAME_CENTER_PAGE = `${KBO_URL}/Schedule/GameCenter/Main.aspx`

/** Every series, for a day's game list */
const ALL_SERIES = '0,1,3,4,5,6,7,8,9'

const pad2 = (n: number) => String(n).padStart(2, '0')

/**
 * Fetches a season's schedule from koreabaseball.com: each month's regular season and postseason
 * lists, and July's calendar for the All-Star Game.
 * Throws {@link KboNotFoundError} when it has no games for that season.
 */
export async function fetchKboSchedule(
	season: number,
	fetcher: typeof fetch = fetch,
): Promise<KboSchedule> {
	if (season < KBO_SCHEDULE_MIN_SEASON || season > getScheduleToday().getFullYear() + 1) {
		throw new KboNotFoundError(`koreabaseball.com has no schedule for ${season}`)
	}

	const list = (srIdList: string, month: number) =>
		postKbo<KboGridTable>(
			'/ws/Schedule.asmx/GetScheduleList',
			{ leId: 1, srIdList, seasonId: season, gameMonth: pad2(month), teamId: '' },
			SCHEDULE_PAGE,
			fetcher,
		)

	const [regular, postseason, allStar] = await Promise.all([
		Promise.all(
			KBO_SCHEDULE_MONTHS.map((month) =>
				list(KBO_SCHEDULE_SERIES.regular, month).then((json) => parseKboScheduleList(json, season)),
			),
		),
		Promise.all(
			KBO_POSTSEASON_MONTHS.map((month) =>
				list(KBO_SCHEDULE_SERIES.postseason, month).then((json) =>
					parseKboScheduleList(json, season, true),
				),
			),
		),
		postKbo<KboGridTable>(
			'/ws/Schedule.asmx/GetMonthSchedule',
			{
				leId: 1,
				srIdList: KBO_SCHEDULE_SERIES.regular,
				seasonId: season,
				gameMonth: pad2(KBO_ALL_STAR_MONTH),
			},
			SCHEDULE_PAGE,
			fetcher,
		)
			.then(parseKboAllStar)
			.catch(optional<KboScheduleRow[]>('All-Star Game')),
	])

	const rows = [...regular.flat(), ...postseason.flat(), ...(allStar ?? [])]
	if (!rows.length) throw new KboNotFoundError(`koreabaseball.com has no schedule for ${season}`)

	return buildKboSchedule({ season, rows })
}

const scheduleCache = createMemoryCache<number, KboSchedule>({
	keepError: (e) => e instanceof KboNotFoundError,
})

/**
 * {@link fetchKboSchedule}, cached in memory per season like the standings: briefly for the
 * current season, for a week for past ones.
 */
export function getKboSchedule(
	season: number,
	{
		fetcher = fetch,
		now = Date.now(),
		currentSeason = getScheduleToday().getFullYear(),
	}: { fetcher?: typeof fetch; now?: number; currentSeason?: number } = {},
): Promise<KboSchedule> {
	const ttl = season < currentSeason ? PAST_SEASON_TTL_MS : CURRENT_SEASON_TTL_MS
	return scheduleCache.get(season, ttl, () => fetchKboSchedule(season, fetcher), now)
}

/** For tests. */
export function clearKboScheduleCache() {
	scheduleCache.clear()
}

/** For the extras, which the page shows without (a roster, a box score not posted yet) */
function optional<T>(label: string) {
	return (e: unknown): T | null => {
		console.warn(`[kbo] ${label}:`, e instanceof Error ? e.message : e)
		return null
	}
}

const LIVE_GAME_TTL_MS = 30_000

/** From the day before `today` (in Korea) on: such a game may still change */
export function isRecentKboDate(date: string, today = koreaToday()) {
	const yesterday = new Date(`${today}T00:00:00Z`)
	yesterday.setUTCDate(yesterday.getUTCDate() - 1)
	return date >= yesterday.toISOString().slice(0, 10)
}

const ttlFor = (date: string, today?: string) =>
	isRecentKboDate(date, today) ? LIVE_GAME_TTL_MS : PAST_SEASON_TTL_MS

const gameListCache = createMemoryCache<string, KboGameSummary[]>({ max: 100 })

/** A day's games from its game list, cached like a game: briefly from yesterday on */
export function getKboGameList(
	date: string,
	{
		fetcher = fetch,
		now = Date.now(),
		today,
	}: { fetcher?: typeof fetch; now?: number; today?: string } = {},
): Promise<KboGameSummary[]> {
	return gameListCache.get(
		date,
		ttlFor(date, today),
		() =>
			postKbo<{ game?: KboGameListItem[] }>(
				'/ws/Main.asmx/GetKboGameList',
				{ leId: 1, srId: ALL_SERIES, date: date.replace(/-/g, '') },
				GAME_CENTER_PAGE,
				fetcher,
			).then(parseKboGameList),
		now,
	)
}

/** The body the game center's scoreboard and box score requests take */
const gameParams = (summary: Pick<KboGameSummary, 'id' | 'seriesId' | 'date'>) => ({
	leId: 1,
	srId: summary.seriesId,
	seasonId: summary.date.slice(0, 4),
	gameId: summary.id,
})

const scoreboardCache = createMemoryCache<string, KboScoreboard>({ max: 500 })

/** A game's scoreboard, cached like a game */
export function getKboScoreboard(
	summary: Pick<KboGameSummary, 'id' | 'seriesId' | 'date'>,
	{
		fetcher = fetch,
		now = Date.now(),
		today,
	}: { fetcher?: typeof fetch; now?: number; today?: string } = {},
): Promise<KboScoreboard> {
	return scoreboardCache.get(
		summary.id,
		ttlFor(summary.date, today),
		() =>
			postKbo<KboScoreboardResponse>(
				'/ws/Schedule.asmx/GetScoreBoardScroll',
				gameParams(summary),
				GAME_CENTER_PAGE,
				fetcher,
			).then(parseKboScoreboard),
		now,
	)
}

/** For tests. */
export function clearKboGameListCaches() {
	gameListCache.clear()
	scoreboardCache.clear()
	gameCache.clear()
}

/** At most this many koreabaseball.com scoreboards are read at once */
const SCOREBOARD_CONCURRENCY = 6

/**
 * `games` brought up to date for the schedule pages: each day's game list (state, inning, count,
 * runners, starters) for days from today (in Korea) back, and the scoreboard of each game under
 * way or over. Anything that can't be read is left `null`.
 */
export async function withKboScheduleDetails(
	games: KboScheduleGame[],
	{ fetcher = fetch, today = koreaToday() }: { fetcher?: typeof fetch; today?: string } = {},
): Promise<KboScheduleGame[]> {
	const result = games.map((game) => ({ ...game }))
	const dates = [...new Set(result.map((game) => game.date))].filter((date) => date <= today)

	const lists = new Map(
		await Promise.all(
			dates.map(
				async (date) =>
					[
						date,
						await getKboGameList(date, { fetcher, today }).catch(
							optional<KboGameSummary[]>(`games on ${date}`),
						),
					] as const,
			),
		),
	)

	for (const game of result) {
		const list = lists.get(game.date)
		if (list !== undefined) game.summary = list?.find((summary) => summary.id === game.id) ?? null
	}

	const queue = result.filter(
		(game) => game.summary && game.summary.state !== 'Preview' && !game.summary.isCancelled,
	)

	async function worker() {
		for (let game = queue.shift(); game; game = queue.shift()) {
			game.linescore = await getKboScoreboard(game.summary!, { fetcher, today }).catch(
				optional<KboScoreboard>(`scoreboard ${game.id}`),
			)
		}
	}

	await Promise.all(Array.from({ length: SCOREBOARD_CONCURRENCY }, worker))
	return result
}

/** GETs a koreabaseball.com page's HTML */
async function fetchPage(url: string, fetcher: typeof fetch, init: RequestInit = {}) {
	const response = await fetcher(url, {
		...init,
		headers: { accept: 'text/html', ...init.headers },
		signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
	})
	if (!response.ok) throw new Error(`${url} responded ${response.status}`)
	return response.text()
}

/**
 * Fetches a team's registered (first-team) roster from koreabaseball.com, as of the latest day
 * with one: the register page, then a postback for the team if the page shows another.
 * Throws {@link KboNotFoundError} for a team that isn't a KBO club.
 */
export async function fetchKboRoster(
	teamId: number,
	fetcher: typeof fetch = fetch,
): Promise<KboRoster> {
	const team = kboTeamById(teamId)
	if (!team || !isKboTeam(teamId)) {
		throw new KboNotFoundError(`koreabaseball.com has no roster for team ${teamId}`)
	}

	const html = await fetchPage(KBO_REGISTER_URL, fetcher)
	const form = kboRegisterForm(html)
	if (!form) throw new Error('No register form on koreabaseball.com')
	if (form.team === team.code) return parseKboRegister(html)

	const roster = parseKboRegister(
		await fetchPage(KBO_REGISTER_URL, fetcher, {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				referer: KBO_REGISTER_URL,
			},
			body: kboRegisterPostback(form, team.code).toString(),
		}),
	)
	if (roster.teamId !== teamId) throw new Error(`koreabaseball.com showed another team's register`)
	return roster
}

const rosterCache = createMemoryCache<number, KboRoster>({
	keepError: (e) => e instanceof KboNotFoundError,
})

/** {@link fetchKboRoster}, cached in memory per team for as long as a current season's standings */
export function getKboRoster(
	teamId: number,
	{ fetcher = fetch, now = Date.now() }: { fetcher?: typeof fetch; now?: number } = {},
): Promise<KboRoster> {
	return rosterCache.get(teamId, CURRENT_SEASON_TTL_MS, () => fetchKboRoster(teamId, fetcher), now)
}

/** For tests. */
export function clearKboRosterCache() {
	rosterCache.clear()
}

/** Gives the box score's players their koreabaseball.com IDs from the teams' rosters, by name */
function withPlayerIds(box: KboBox | null, rosters: Record<KboSide, KboRoster | null>) {
	if (!box) return null
	const ids = (side: KboSide) => {
		const byName = new Map<string, string | null>()
		for (const player of rosters[side]?.players ?? []) {
			// Two players with one name: neither gets an ID
			byName.set(player.nameKo, byName.has(player.nameKo) ? null : player.id)
		}
		return byName
	}
	const named = (side: KboSide, byName = ids(side)) => {
		const withId = <T extends { player: KboPlayerRef }>(line: T): T => ({
			...line,
			player: { ...line.player, id: byName.get(line.player.nameKo) ?? null },
		})
		return {
			batters: box.teams[side].batters.map(withId),
			pitchers: box.teams[side].pitchers.map(withId),
		}
	}
	return { ...box, teams: { away: named('away'), home: named('home') } }
}

/**
 * Fetches a game from koreabaseball.com: its day's game list (required, for its series and
 * state), its scoreboard, and its box score once it has started, plus both teams' rosters for
 * player IDs and photos. Throws {@link KboNotFoundError} for a game the day doesn't have.
 */
export async function fetchKboGame(id: string, fetcher: typeof fetch = fetch): Promise<KboGame> {
	const ref = parseKboGameId(id)
	if (!ref) throw new KboNotFoundError(`${id} isn't a KBO game ID`)

	const summary = (await getKboGameList(ref.date, { fetcher })).find((game) => game.id === id)
	if (!summary) throw new KboNotFoundError(`koreabaseball.com has no game ${id}`)

	const started = summary.state !== 'Preview' && !summary.isCancelled
	const away = kboTeamByCode(ref.away)!
	const home = kboTeamByCode(ref.home)!

	const [scoreboard, rawBox, awayRoster, homeRoster] = await Promise.all([
		summary.isCancelled
			? null
			: getKboScoreboard(summary, { fetcher }).catch(optional<KboScoreboard>('scoreboard')),
		started
			? postKbo<KboBoxScoreResponse>(
					'/ws/Schedule.asmx/GetBoxScoreScroll',
					gameParams(summary),
					GAME_CENTER_PAGE,
					fetcher,
				)
					.then(parseKboBoxScore)
					.catch(optional<KboBox>('box score'))
			: null,
		...[away, home].map((team) =>
			isKboTeam(team.id)
				? getKboRoster(team.id, { fetcher }).catch(optional<KboRoster>(`roster ${team.code}`))
				: null,
		),
	])

	const rosters = { away: awayRoster, home: homeRoster }
	const box = withPlayerIds(rawBox, rosters)

	const photos: Record<string, string> = {}
	for (const roster of [awayRoster, homeRoster]) {
		for (const player of roster?.players ?? []) photos[player.id] = player.photo
	}

	const gameTeam = (side: KboSide, info: KboTeamInfo): KboGameTeam => ({
		id: info.id,
		code: info.code,
		nameKo: info.fullNameKo.split(' ')[0],
		fullNameKo: info.fullNameKo,
		name: info.name,
		teamName: info.teamName,
		abbreviation: info.abbreviation,
		runs: scoreboard?.teams[side].runs ?? summary.runs[side],
		hits: scoreboard?.teams[side].hits ?? null,
		errors: scoreboard?.teams[side].errors ?? null,
		walks: scoreboard?.teams[side].walks ?? null,
		record: summary.competition === 'all-star' ? null : (scoreboard?.records[side] ?? null),
	})

	const pitcherLine = (player: KboPlayerRef | null) =>
		player
			? [...(box?.teams.away.pitchers ?? []), ...(box?.teams.home.pitchers ?? [])].find(
					(line) => line.player.nameKo === player.nameKo,
				)
			: undefined

	const decision = (key: 'win' | 'loss' | 'save'): KboDecision | null => {
		const player = summary.decisions[key]
		if (!player) return null
		// Outside the regular season the box score leaves pitchers' records at 0
		const record =
			summary.competition === 'regular' ? decisionRecord(pitcherLine(player), key) : null
		return { player, record }
	}

	return {
		...summary,
		season: ref.season,
		venueKo: summary.venueKo ?? scoreboard?.venueKo ?? null,
		startTime: scoreboard?.startTime ?? summary.startTime,
		endTime: scoreboard?.endTime ?? null,
		duration: scoreboard?.duration ?? null,
		attendance: scoreboard?.attendance ?? null,
		teams: { away: gameTeam('away', away), home: gameTeam('home', home) },
		innings: scoreboard?.innings ?? [],
		starters: summary.starters,
		decisions: { win: decision('win'), loss: decision('loss'), save: decision('save') },
		box,
		plays: kboPlays(box),
		homeRuns: parseKboHomeRuns(box),
		umpires: noteNames(box, '심판'),
		photos,
		url: kboGameCenterUrl(id),
	}
}

const gameCache = createMemoryCache<string, KboGame>({
	keepError: (e) => e instanceof KboNotFoundError,
})

/**
 * {@link fetchKboGame}, cached in memory: briefly for games from yesterday on (which may be live
 * or about to be), and like a past season's standings for older ones.
 */
export function getKboGame(
	id: string,
	{
		fetcher = fetch,
		now = Date.now(),
		today,
	}: { fetcher?: typeof fetch; now?: number; today?: string } = {},
): Promise<KboGame> {
	const date = parseKboGameId(id)?.date ?? ''
	return gameCache.get(id, ttlFor(date, today), () => fetchKboGame(id, fetcher), now)
}

/** The game page and API share one cache policy: a past game's page won't change */
export function cacheControlForKboGame(game: Pick<KboGame, 'date' | 'state'>) {
	if (!isRecentKboDate(game.date)) return cacheControlForGame('Final')
	// The game list updates a live game every half minute or so, and a finished one can be corrected
	if (game.state === 'Final') return 'public, s-maxage=300, stale-while-revalidate=3600'
	if (game.state === 'Live') return 'public, s-maxage=30, stale-while-revalidate=60'
	return cacheControlForGame('Preview')
}
