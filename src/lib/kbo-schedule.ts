/**
 * KBO's season schedule from koreabaseball.com's schedule page (Schedule/Schedule.aspx) and the
 * JSON web services it calls:
 *
 * - `Schedule.asmx/GetScheduleList` lists a month's games for a set of series (`srIdList`): the
 *   regular season (0,9,6) or the postseason (3,4,5,7). Each row has the time, the teams (away
 *   first) and score, a link to the game center with the game's ID once there is one (preview,
 *   then review), the venue, and a remark: why it was called off (우천취소), or in the
 *   postseason, the round's game (KS 4차전). Days off in the postseason are rows with just a
 *   remark (이동일, travel day).
 * - `Schedule.asmx/GetMonthSchedule` is the same month as a calendar; it's read for the All-Star
 *   Game alone, which GetScheduleList leaves out.
 *
 * A day's game list (`parseKboGameList`) and each game's scoreboard bring a day's games up to date
 * for the schedule pages: the state, inning, runners and linescore.
 *
 * Shipping this needs KBO's prior approval: koreabaseball.com prohibits automated collection of
 * its data without it (see `kbo.ts`).
 */

import {
	kboGamePath,
	parseKboGameId,
	type KboCompetition,
	type KboGameState,
	type KboGameSummary,
	type KboScoreboard,
	type KboSide,
} from '#lib/kbo-game.js'
import {
	cellText,
	KBO_SPORT_ID,
	kboGrid,
	kboTeamByCode,
	kboTeamByName,
	type KboGridTable,
	type KboRecord,
} from '#lib/kbo.js'

/** First season koreabaseball.com's schedule has with all ten of today's clubs (KT joined) */
export const KBO_SCHEDULE_MIN_SEASON = 2015

/** Months with regular season games (2020's started in May and ran to the end of October) */
export const KBO_SCHEDULE_MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11]

/** Months the postseason can fall in */
export const KBO_POSTSEASON_MONTHS = [10, 11]

/** The month of the All-Star Game */
export const KBO_ALL_STAR_MONTH = 7

/** `srIdList` for GetScheduleList */
export const KBO_SCHEDULE_SERIES = { regular: '0,9,6', postseason: '3,4,5,7' } as const

export const KBO_SCHEDULE_URL = 'https://www.koreabaseball.com/Schedule/Schedule.aspx'

export interface KboScheduleTeam {
	/** MLB Stats API team ID (a stand-in for the All-Star sides) */
	id: number
	/** koreabaseball.com's team code, e.g. `OB` */
	code: string
	/** As the schedule prints it, e.g. 두산 */
	nameKo: string
	runs: number | null
	/**
	 * The team's record after this game, like the Stats API's `leagueRecord`: the season's, or in a
	 * postseason round, the round's. `null` for the All-Star sides.
	 */
	record: KboRecord | null
}

/**
 * Consecutive games at one park between the same two teams, like the Stats API's series; in the
 * postseason, the round
 */
export interface KboScheduleSeries {
	/** Game of the series, from 1 */
	number: number
	/** Games in the series, called-off ones included */
	total: number
	/** Wins in the series through this game */
	homeWins: number
	awayWins: number
}

export interface KboScheduleGame {
	/** koreabaseball.com's game ID, e.g. `20261001NCOB0`; worked out until the schedule links one */
	id: string
	competition: KboCompetition
	/** ISO date */
	date: string
	teams: Record<KboSide, KboScheduleTeam>
	/** e.g. 잠실 */
	venueKo: string | null
	/** `HH:MM`, Korea time */
	startTime: string | null
	state: KboGameState
	isCancelled: boolean
	/** Why it was called off, e.g. 우천취소 (rain) */
	cancelReasonKo: string | null
	/** Ended level */
	isTie: boolean
	/** Whether the schedule links the game yet */
	linked: boolean
	series: KboScheduleSeries
	/**
	 * The day's game list's take on the game, fresher than the schedule's: the state, inning,
	 * count, runners and starters. Only when asked for (`?linescores=1`), and `null` if it
	 * couldn't be read.
	 */
	summary?: KboGameSummary | null
	/** The game's scoreboard, once it's under way; only when asked for, like `summary` */
	linescore?: KboScoreboard | null
}

/** A row of the schedule list, before records and series are worked out */
export type KboScheduleRow = Omit<KboScheduleGame, 'series' | 'linked' | 'id'> & {
	/** From the schedule's link, once there is one */
	id: string | null
}

const POSTSEASON_LABELS: [RegExp, KboCompetition][] = [
	[/^WC/, 'wild-card'],
	[/^준\s*PO/, 'semi-playoff'],
	[/^PO/, 'playoff'],
	[/^KS/, 'korean-series'],
]

/** A remark that means the game was called off: rain (우천), wet grounds (그라운드사정) and so on */
const CANCELLED = /취소|사정|노게임|순연|연기/

function team(html: string, runs: string | undefined) {
	const info = kboTeamByName(cellText(html))
	if (!info) return null
	return {
		id: info.id,
		code: info.code,
		nameKo: cellText(html),
		runs: runs !== undefined && /^\d+$/.test(runs) ? Number(runs) : null,
		record: null,
	}
}

/**
 * Every game in a month's schedule list (regular season or postseason), in koreabaseball.com's
 * order. A row's first cell is the date when it's the day's first game.
 */
export function parseKboScheduleList(
	json: KboGridTable,
	season: number,
	postseason = false,
): KboScheduleRow[] {
	const rows: KboScheduleRow[] = []
	let date: string | null = null

	for (const { row } of kboGrid(json).rows ?? []) {
		const day = row.find((cell) => cell.Class === 'day')
		const mmdd = day && cellText(day.Text ?? '').match(/^(\d{2})\.(\d{2})/)
		if (mmdd) date = `${season}-${mmdd[1]}-${mmdd[2]}`

		const play = row.find((cell) => cell.Class === 'play')?.Text
		if (!date || !play) continue

		// <span>NC</span><em><span class="lose">7</span><span>vs</span><span class="win">9</span></em><span>두산</span>
		const names = [...play.matchAll(/^<span>([^<]*)<\/span>|<\/em>\s*<span>([^<]*)<\/span>/g)].map(
			(m) => m[1] ?? m[2],
		)
		const scores = [
			...(play.match(/<em>([\s\S]*?)<\/em>/)?.[1] ?? '').matchAll(/<span[^>]*>([^<]*)<\/span>/g),
		]
			.map((m) => m[1])
			.filter((text) => text !== 'vs')

		const away = team(names[0] ?? '', scores[0])
		const home = team(names[1] ?? '', scores[1])
		if (!away || !home) continue

		const relay = row.find((cell) => cell.Class === 'relay')?.Text ?? ''
		const id = relay.match(/gameId=(\d{8}[A-Z]{4}\d)/)?.[1] ?? null
		// 리뷰 (review) once it's over; 프리뷰 (preview) before
		const reviewed = />\s*리뷰\s*</.test(relay)

		const cells = row.map((cell) => cellText(cell.Text ?? ''))
		const remark = cells.at(-1) ?? ''
		const venue = cells.at(-2) ?? ''
		const isCancelled = CANCELLED.test(remark)

		const hasScore = away.runs !== null && home.runs !== null
		const state: KboGameState = isCancelled || reviewed ? 'Final' : hasScore ? 'Live' : 'Preview'

		const label = postseason ? POSTSEASON_LABELS.find(([pattern]) => pattern.test(remark)) : null

		rows.push({
			id,
			competition: label?.[1] ?? 'regular',
			date,
			teams: { away, home },
			venueKo: venue && venue !== '-' ? venue : null,
			startTime:
				cellText(row.find((cell) => cell.Class === 'time')?.Text ?? '')
					.match(/^\d{1,2}:\d{2}$/)?.[0]
					.padStart(5, '0') ?? null,
			state,
			isCancelled,
			cancelReasonKo: isCancelled ? remark : null,
			isTie: state === 'Final' && !isCancelled && hasScore && away.runs === home.runs,
		})
	}

	return rows
}

/**
 * The All-Star Game from a month's calendar: the only game between its two sides (나눔 and 드림,
 * `WE` and `EA`), with its score once played (나눔 <b>10 : 2</b> 드림, away first).
 */
export function parseKboAllStar(json: KboGridTable): KboScheduleRow[] {
	const rows: KboScheduleRow[] = []

	for (const { row } of kboGrid(json).rows ?? []) {
		for (const cell of row) {
			for (const m of (cell.Text ?? '').matchAll(
				/gameId=(\d{8}(?:WE|EA){2}\d)[^>]*>\s*<li>([^<]*)(?:<b>\s*(\d+)\s*:\s*(\d+)\s*<\/b>)?/g,
			)) {
				const ref = parseKboGameId(m[1])
				const awayInfo = ref && kboTeamByCode(ref.away)
				const homeInfo = ref && kboTeamByCode(ref.home)
				if (!ref || !awayInfo || !homeInfo) continue

				const side = (info: typeof awayInfo, runs: string | undefined) => ({
					id: info.id,
					code: info.code,
					nameKo: info.fullNameKo.split(' ')[0],
					runs: runs ? Number(runs) : null,
					record: null,
				})
				const played = m[3] !== undefined

				rows.push({
					id: m[1],
					competition: 'all-star',
					date: ref.date,
					teams: { away: side(awayInfo, m[3]), home: side(homeInfo, m[4]) },
					venueKo: null,
					startTime: null,
					state: played ? 'Final' : 'Preview',
					isCancelled: false,
					cancelReasonKo: null,
					isTie: played && m[3] === m[4],
				})
			}
		}
	}

	return rows
}

const pairKey = (a: string, b: string) => [a, b].sort().join('-')

const emptyRecord = (): KboRecord => ({ wins: 0, losses: 0, ties: 0 })

const won = (game: Pick<KboScheduleRow, 'state' | 'isCancelled' | 'teams'>, side: KboSide) => {
	const team = game.teams[side]
	const other = game.teams[side === 'home' ? 'away' : 'home']
	if (game.state !== 'Final' || game.isCancelled || team.runs === null || other.runs === null) {
		return null
	}
	return team.runs > other.runs ? 'W' : team.runs < other.runs ? 'L' : 'T'
}

function addResult(record: KboRecord, game: KboScheduleRow, side: KboSide): KboRecord {
	const result = won(game, side)
	return {
		wins: record.wins + (result === 'W' ? 1 : 0),
		losses: record.losses + (result === 'L' ? 1 : 0),
		ties: record.ties + (result === 'T' ? 1 : 0),
	}
}

/**
 * A game's ID from its date, teams and doubleheader number: what koreabaseball.com will link it
 * as, for a game the schedule doesn't link yet (or a called-off one)
 */
export const kboGameId = (date: string, away: string, home: string, number = 0) =>
	`${date.replace(/-/g, '')}${away}${home}${number}`

export interface KboSchedule {
	season: number
	/** Regular season, postseason and All-Star games, in order */
	games: KboScheduleGame[]
	/** All-Star Game dates, which split the season like MLB's break */
	allStarDates: string[]
}

/**
 * The season's games from its months' rows, each with its record and series, and an ID from
 * koreabaseball.com's link or else worked out from its date and teams.
 */
export function buildKboSchedule({
	season,
	rows,
}: {
	season: number
	rows: KboScheduleRow[]
}): KboSchedule {
	// Stable, so a day keeps koreabaseball.com's order
	const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))

	/** A pair's games on a day, for doubleheaders' numbers */
	const perDay = new Map<string, number>()
	for (const row of sorted) {
		const key = `${row.date}:${row.teams.away.code}-${row.teams.home.code}`
		perDay.set(key, (perDay.get(key) ?? 0) + 1)
	}
	const numbered = new Map<string, number>()

	/** Each team's regular season record so far, and each pair's record in a postseason round */
	const records = new Map<string, KboRecord>()

	const games = sorted.map((row): KboScheduleGame => {
		const pairDay = `${row.date}:${row.teams.away.code}-${row.teams.home.code}`
		const n = (numbered.get(pairDay) ?? 0) + 1
		numbered.set(pairDay, n)
		const id =
			row.id ??
			kboGameId(
				row.date,
				row.teams.away.code,
				row.teams.home.code,
				perDay.get(pairDay)! > 1 ? n : 0,
			)

		const withRecord = (side: KboSide): KboScheduleTeam => {
			const t = row.teams[side]
			if (row.competition === 'all-star') return t
			const key =
				row.competition === 'regular'
					? String(t.id)
					: `${row.competition}:${pairKey(row.teams.away.code, row.teams.home.code)}:${t.id}`
			const record = addResult(records.get(key) ?? emptyRecord(), row, side)
			records.set(key, record)
			return { ...t, record }
		}

		return {
			...row,
			id,
			teams: { away: withRecord('away'), home: withRecord('home') },
			linked: !!row.id,
			series: { number: 0, total: 0, homeWins: 0, awayWins: 0 },
		}
	})

	numberSeries(games.filter((game) => game.competition === 'regular'))
	numberRounds(games.filter((game) => game.competition !== 'regular'))

	const allStarDates = [
		...new Set(games.filter((game) => game.competition === 'all-star').map((game) => game.date)),
	]

	return { season, games, allStarDates }
}

const DAY_MS = 86_400_000

/** More days off than this between two games at one park makes them separate series */
const SERIES_MAX_GAP_DAYS = 2

const winFor = (game: KboScheduleGame, side: KboSide) => (won(game, side) === 'W' ? 1 : 0)

/**
 * Fills in each regular season game's `series`: a run of games between the same two teams at the
 * same home team, with neither playing anyone else in between.
 */
function numberSeries(games: KboScheduleGame[]) {
	const last = new Map<number, KboScheduleGame>()
	const all: KboScheduleGame[][] = []
	const open = new Map<number, KboScheduleGame[]>()

	for (const game of games) {
		const { home, away } = game.teams
		const series = open.get(home.id)
		const previous = series?.at(-1)
		const continues =
			previous &&
			previous.teams.away.id === away.id &&
			last.get(home.id) === previous &&
			last.get(away.id) === previous &&
			(Date.parse(game.date) - Date.parse(previous.date)) / DAY_MS <= SERIES_MAX_GAP_DAYS + 1

		const current = continues ? series! : []
		if (!continues) {
			all.push(current)
			open.set(home.id, current)
		}

		const before = continues ? previous.series : { homeWins: 0, awayWins: 0 }
		current.push(game)
		game.series = {
			number: current.length,
			total: 0,
			homeWins: before.homeWins + winFor(game, 'home'),
			awayWins: before.awayWins + winFor(game, 'away'),
		}
		last.set(home.id, game)
		last.set(away.id, game)
	}

	for (const series of all) for (const game of series) game.series.total = series.length
}

/**
 * Fills in each postseason (and All-Star) game's `series`: the round between its two teams, which
 * play at both parks. Wins are this game's home and away teams', through this game.
 */
function numberRounds(games: KboScheduleGame[]) {
	const rounds = new Map<string, KboScheduleGame[]>()
	for (const game of games) {
		const key = `${game.competition}:${pairKey(game.teams.home.code, game.teams.away.code)}`
		rounds.set(key, [...(rounds.get(key) ?? []), game])
	}

	for (const round of rounds.values()) {
		const teamWins = new Map<number, number>()
		round.forEach((game, i) => {
			for (const side of ['home', 'away'] as const) {
				const { id } = game.teams[side]
				teamWins.set(id, (teamWins.get(id) ?? 0) + winFor(game, side))
			}
			game.series = {
				number: i + 1,
				total: round.length,
				homeWins: teamWins.get(game.teams.home.id) ?? 0,
				awayWins: teamWins.get(game.teams.away.id) ?? 0,
			}
		})
	}
}

/** Games between `startDate` and `endDate` (inclusive), and/or for one team */
export function filterKboSchedule(
	games: KboScheduleGame[],
	{ startDate, endDate, teamId }: { startDate?: string; endDate?: string; teamId?: number },
) {
	return games.filter(
		(game) =>
			(!startDate || game.date >= startDate) &&
			(!endDate || game.date <= endDate) &&
			(!teamId || game.teams.home.id === teamId || game.teams.away.id === teamId),
	)
}

/**
 * The schedule's game, brought up to date by the day's game list and its scoreboard where the
 * schedule pages have read them: the state, venue, start time and score.
 */
export function currentKboScheduleGame(game: KboScheduleGame): KboScheduleGame {
	const { summary, linescore } = game
	if (!summary) return game

	const runs = (side: KboSide) => ({
		...game.teams[side],
		runs: linescore?.teams[side].runs ?? summary.runs[side] ?? game.teams[side].runs,
		record: linescore?.records[side] ?? game.teams[side].record,
	})
	return {
		...game,
		state: summary.state,
		isCancelled: summary.isCancelled,
		cancelReasonKo: summary.cancelReasonKo ?? game.cancelReasonKo,
		venueKo: summary.venueKo ?? game.venueKo,
		startTime: summary.startTime ?? game.startTime,
		teams: { away: runs('away'), home: runs('home') },
	}
}

/** The game's page here */
export const kboScheduleGamePath = (game: KboScheduleGame) => kboGamePath(game.id)

/** The sports with games in `season` once KBO's are added: the Stats API's leagues', plus KBO */
export function withKboSportId(sportIds: number[], season: number | string) {
	return Number(season) >= KBO_SCHEDULE_MIN_SEASON && !sportIds.includes(KBO_SPORT_ID)
		? [...sportIds, KBO_SPORT_ID]
		: sportIds
}

/** What `/api/kbo/schedule/{season}` answers */
export interface KboScheduleResponse {
	season: number
	source: string
	allStarDates: string[]
	games: KboScheduleGame[]
}

/**
 * A season's KBO schedule from our API route, narrowed like {@link filterKboSchedule}. A season
 * koreabaseball.com has no schedule for comes back empty; other failures throw.
 */
export async function loadKboSchedule(
	season: number | string,
	query: { startDate?: string; endDate?: string; teamId?: number; linescores?: boolean } = {},
	fetcher: typeof fetch = fetch,
): Promise<KboScheduleResponse> {
	const params = new URLSearchParams(
		Object.entries(query)
			.filter(([, value]) => value !== undefined && value !== false)
			.map(([key, value]) => [key, value === true ? '1' : String(value)]),
	)
	const response = await fetcher(`/api/kbo/schedule/${season}${params.size ? `?${params}` : ''}`)

	if (response.status === 404) {
		return { season: Number(season), source: '', allStarDates: [], games: [] }
	}
	if (!response.ok) throw new Error(`KBO schedule responded ${response.status}`)

	return response.json()
}
