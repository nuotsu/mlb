/**
 * Parsers for NPB's season schedule on npb.jp:
 *
 * - The monthly detail pages (npb.jp/games/{season}/schedule_{MM}_detail.html) list every game:
 *   the date, home and away teams (home first), venue, start time, then the score and W/L (or
 *   tie) pitchers once played, or the probable starters the day before. Postseason games are
 *   listed too, with nothing to tell them apart, and All-Star games as セ・リーグ vs パ・リーグ.
 * - The English calendar (npb.jp/bis/eng/{season}/calendar/index_{MM}.html) labels the
 *   Climax Series and Nippon Series games, which is how the postseason is told apart.
 *
 * A game's page code (`{home}-{away}-{nn}`) is only linked once the game has started. `nn` is the
 * game of the season series between the two teams (or of a postseason round, or the All-Star
 * Game): one more than the games they have finished (called-off games don't count), so it's
 * worked out for the games not linked yet.
 */

import type { NpbGame, NpbGameRef, NpbGameState, NpbGameTeam, NpbSide } from '#lib/npb-game.js'
import { NPB_TEAM_INFO } from '#lib/npb-roster.js'
import { cellText, compact, NPB_ALL_STAR_TEAMS, NPB_SPORT_ID, type NpbRecord } from '#lib/npb.js'

/** First season whose schedule npb.jp publishes with the current team codes (Orix was `bs`) */
export const NPB_SCHEDULE_MIN_SEASON = 2019

/** Months with regular season games (2020's started in June and ran into November) */
export const NPB_SCHEDULE_MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11]

/** Months the postseason can start in, so the English calendar is read for these alone */
export const NPB_POSTSEASON_MONTHS = [10, 11]

const pad = (n: number) => String(n).padStart(2, '0')

export function npbScheduleUrl(season: number, month: number) {
	return `https://npb.jp/games/${season}/schedule_${pad(month)}_detail.html`
}

export function npbCalendarUrl(season: number, month: number) {
	return `https://npb.jp/bis/eng/${season}/calendar/index_${pad(month)}.html`
}

export interface NpbScheduleTeam {
	/** MLB Stats API team ID */
	id: number
	/** npb.jp's page code, e.g. `t` */
	code: string
	/** As the schedule prints it, e.g. 阪神 */
	shortNameJa: string
	runs: number | null
	/**
	 * The team's record after this game, like the Stats API's `leagueRecord`: the season's, or in a
	 * postseason round, the round's. `null` for the All-Star sides.
	 */
	record: NpbRecord | null
}

export interface NpbSchedulePitchers {
	/** Probable starters, announced the day before */
	away: string | null
	home: string | null
	win: string | null
	loss: string | null
	save: string | null
}

/** What a game is part of: the season, a postseason round, or the All-Star Game */
export type NpbCompetition =
	| 'regular'
	| 'climax-first'
	| 'climax-final'
	/** The Climax Series in one stage (2020's Pacific League) */
	| 'climax'
	| 'japan-series'
	| 'all-star'

export interface NpbScheduleGame {
	ref: NpbGameRef
	competition: NpbCompetition
	/** ISO date */
	date: string
	teams: Record<NpbSide, NpbScheduleTeam>
	/** e.g. 甲子園 */
	venueJa: string | null
	/** `HH:MM`, Japan time */
	startTime: string | null
	state: NpbGameState
	/** Called off: 中止 (postponed) or ノーゲーム */
	isCancelled: boolean
	/** npb.jp's status, when there's more to it than a score: 中止, ノーゲーム, or a live inning */
	statusJa: string | null
	/** Ended level, with 分 (tie) pitchers */
	isTie: boolean
	/** Pitcher names in Japanese, as npb.jp prints them */
	pitchers: NpbSchedulePitchers
	/** Whether npb.jp links the game yet; if not, `ref.code` is worked out from earlier games */
	linked: boolean
	series: NpbScheduleSeries
	/**
	 * The game's own state and linescore, from its page on npb.jp, which is fresher than the
	 * schedule's. Only when asked for (`/api/npb/schedule/{season}?linescores=1`), and `null` if the
	 * page couldn't be read.
	 */
	linescore?: NpbScheduleLinescore | null
}

/**
 * Consecutive games at one park between the same two teams, like the Stats API's series; in the
 * postseason, the round
 */
export interface NpbScheduleSeries {
	/** Game of the series, from 1 */
	number: number
	/** Games in the series, called-off ones included */
	total: number
	/** Wins in the series through this game */
	homeWins: number
	awayWins: number
}

export type NpbScheduleLinescore = Pick<
	NpbGame,
	'state' | 'statusJa' | 'isCancelled' | 'currentInning' | 'innings'
> & {
	teams: Record<NpbSide, Pick<NpbGameTeam, 'runs' | 'hits' | 'errors'>>
	/** Why it was called off, e.g. 雨天 (see `parseNpbCancelReason`) */
	cancelReasonJa: string | null
}

/** The parts of a parsed game page the schedule pages show */
export function toNpbScheduleLinescore(
	game: NpbGame,
	cancelReasonJa: string | null = null,
): NpbScheduleLinescore {
	const side = ({ runs, hits, errors }: NpbGameTeam) => ({ runs, hits, errors })
	return {
		state: game.state,
		statusJa: game.statusJa,
		isCancelled: game.isCancelled,
		currentInning: game.currentInning,
		innings: game.innings,
		teams: { away: side(game.teams.away), home: side(game.teams.home) },
		cancelReasonJa: game.isCancelled ? cancelReasonJa : null,
	}
}

export interface NpbSchedule {
	season: number
	/** Regular season, postseason and All-Star games, in order */
	games: NpbScheduleGame[]
	/** All-Star games' dates, which split the season like MLB's break */
	allStarDates: string[]
}

/** A row of a detail page, before the postseason is told apart and codes are worked out */
export interface NpbScheduleRow extends Omit<
	NpbScheduleGame,
	'ref' | 'linked' | 'series' | 'linescore'
> {
	/** From npb.jp's link, once there is one */
	code: string | null
}

const TEAM_BY_SHORT_NAME: Record<string, number> = {
	巨人: 241,
	阪神: 341,
	中日: 2798,
	広島: 2805,
	ヤクルト: 2673,
	DeNA: 2800,
	ソフトバンク: 242,
	日本ハム: 2671,
	オリックス: 2797,
	楽天: 2674,
	西武: 240,
	ロッテ: 2670,
}

/** npb.jp's page codes by team ID, the All-Star sides' included */
const CODE_BY_ID = new Map<number, string>([
	...Object.entries(NPB_TEAM_INFO).map(([id, { code }]) => [Number(id), code] as const),
	...Object.entries(NPB_ALL_STAR_TEAMS).map(([code, { id }]) => [id as number, code] as const),
])

const ALL_STAR_BY_SHORT_NAME = new Map<string, number>(
	Object.values(NPB_ALL_STAR_TEAMS).map(({ id, shortNameJa }) => [shortNameJa, id]),
)

const div = (html: string, className: string) =>
	html.match(new RegExp(`<div class="${className}">([\\s\\S]*?)</div>`))?.[1]

const text = (html: string | undefined) => (html === undefined ? '' : compact(cellText(html)))

function team(shortNameJa: string, runs: string): Omit<NpbScheduleTeam, 'code' | 'record'> | null {
	const id = TEAM_BY_SHORT_NAME[shortNameJa] ?? ALL_STAR_BY_SHORT_NAME.get(shortNameJa)
	if (!id) return null
	return { id, shortNameJa, runs: /^\d+$/.test(runs) ? Number(runs) : null }
}

function parsePitchers(html: string) {
	const pitchers: NpbSchedulePitchers = {
		away: null,
		home: null,
		win: null,
		loss: null,
		save: null,
	}
	let isTie = false
	const starters: string[] = []

	for (const m of html.matchAll(/<div class="pit">([\s\S]*?)<\/div>/g)) {
		const [label, name] = text(m[1]).split(/[：:]/)
		if (!name) continue
		if (label === '先発') starters.push(name)
		else if (label === '勝') pitchers.win = name
		else if (label === '敗') pitchers.loss = name
		else if (label === 'S') pitchers.save = name
		else if (label === '分') isTie = true
	}

	// Listed home first, like the teams
	pitchers.home = starters[0] ?? null
	pitchers.away = starters[1] ?? null
	return { pitchers, isTie }
}

/**
 * Every game on one month's detail page, home team first in each row as npb.jp lists them. The
 * page doesn't tell postseason games apart (see {@link parseNpbPostseason}).
 */
export function parseNpbScheduleMonth(
	html: string,
	season: number,
): { rows: NpbScheduleRow[]; allStarDates: string[] } {
	const start = html.indexOf('<div id="schedule_detail">')
	const body = start === -1 ? '' : html.slice(start, html.indexOf('</tbody>', start))

	const rows: NpbScheduleRow[] = []
	const allStarDates = new Set<string>()

	for (const row of body.split(/<tr id="date/).slice(1)) {
		const mmdd = row.match(/^(\d{4})"/)?.[1]
		const home = text(div(row, 'team1'))
		const away = text(div(row, 'team2'))
		if (!mmdd || !home || !away) continue

		const date = `${season}-${mmdd.slice(0, 2)}-${mmdd.slice(2)}`
		const isAllStar = ALL_STAR_BY_SHORT_NAME.has(home) || ALL_STAR_BY_SHORT_NAME.has(away)
		if (isAllStar) allStarDates.add(date)

		const teams = {
			home: team(home, text(div(row, 'score1'))),
			away: team(away, text(div(row, 'score2'))),
		}
		if (!teams.home || !teams.away) continue

		const code = row.match(/href="\/scores\/\d{4}\/\d{4}\/([a-z]+-[a-z]+-\d+)\/"/)?.[1] ?? null
		// Called-off games have a `cancel` div in place of the score
		const status = text(div(row, 'cancel')) || text(div(row, 'state'))
		const isCancelled = /中止|ノーゲーム/.test(status)
		const hasScore = teams.home.runs !== null && teams.away.runs !== null
		const { pitchers, isTie } = parsePitchers(row)
		const isFinal = !!(pitchers.win || pitchers.loss || isTie)

		const state: NpbGameState = isCancelled || isFinal ? 'Final' : hasScore ? 'Live' : 'Preview'

		rows.push({
			code,
			competition: isAllStar ? 'all-star' : 'regular',
			date,
			teams: {
				away: { ...teams.away, code: CODE_BY_ID.get(teams.away.id)!, record: null },
				home: { ...teams.home, code: CODE_BY_ID.get(teams.home.id)!, record: null },
			},
			venueJa: text(div(row, 'place')) || null,
			startTime:
				text(div(row, 'time'))
					.match(/^\d{1,2}:\d{2}$/)?.[0]
					.padStart(5, '0') ?? null,
			state,
			isCancelled,
			statusJa: status && status !== '-' ? status : null,
			isTie,
			pitchers,
		})
	}

	return { rows, allStarDates: [...allStarDates] }
}

export interface NpbPostseason {
	/** First day with a postseason game, as an ISO date */
	start: string | null
	/** By `{mmdd}/{home}-{away}`, e.g. `1010/g-db` */
	games: Map<string, NpbCompetition>
}

/** The English calendar's labels, e.g. CS First Stage */
const POSTSEASON_LABELS: [RegExp, NpbCompetition][] = [
	[/First Stage/i, 'climax-first'],
	[/Final Stage/i, 'climax-final'],
	[/Climax|CS/i, 'climax'],
	[/Nippon Series|Japan Series/i, 'japan-series'],
]

/**
 * The month's Climax Series and Nippon Series games on the English calendar. Played games link to
 * their page (`G 1 - 2 DB`); scheduled ones are plain text (`DB - G 14:00`). Either way the home
 * team comes first, and the date from the day's cell.
 */
export function parseNpbPostseason(html: string, season: number, month: number): NpbPostseason {
	const postseason: NpbPostseason = { start: null, games: new Map() }

	for (const cell of html.split(/<td class="stschedule"/).slice(1)) {
		const day = cell.match(/<div class="teschedate">(?:<a[^>]*>)?(\d{1,2})/)?.[1]
		if (!day) continue

		for (const m of cell.matchAll(
			/<div class="tescheaten">([^<]*)<\/div>\s*<div>([\s\S]*?)<\/div>/g,
		)) {
			const competition = POSTSEASON_LABELS.find(([label]) => label.test(m[1]))?.[1]
			if (!competition) continue

			const teams = cellText(m[2]).match(/^([A-Z]+)\b.*?\b([A-Z]+)(?:\s+\d{1,2}:\d{2})?$/)
			if (!teams) continue

			postseason.start ??= `${season}-${pad(month)}-${day.padStart(2, '0')}`
			postseason.games.set(
				`${pad(month)}${day.padStart(2, '0')}/${teams[1].toLowerCase()}-${teams[2].toLowerCase()}`,
				competition,
			)
		}
	}

	return postseason
}

const pairKey = (a: string, b: string) => [a, b].sort().join('-')

const emptyRecord = (): NpbRecord => ({ wins: 0, losses: 0, ties: 0 })

/** `team`'s result in a game, added to `record` */
function addResult(record: NpbRecord, game: Omit<NpbScheduleRow, 'code'>, side: NpbSide) {
	const team = game.teams[side]
	const other = game.teams[side === 'home' ? 'away' : 'home']
	if (game.state !== 'Final' || game.isCancelled || team.runs === null || other.runs === null) {
		return record
	}
	return {
		wins: record.wins + (team.runs > other.runs ? 1 : 0),
		losses: record.losses + (team.runs < other.runs ? 1 : 0),
		ties: record.ties + (team.runs === other.runs ? 1 : 0),
	}
}

/**
 * The season's games from its months' rows, each with its competition, and a page code from
 * npb.jp's link or else the games so far.
 */
export function buildNpbSchedule({
	season,
	months,
	postseason = { start: null, games: new Map() },
	today,
}: {
	season: number
	months: ReturnType<typeof parseNpbScheduleMonth>[]
	/**
	 * From {@link parseNpbPostseason}. A game from its first day on that it doesn't label belongs to
	 * the same round as its two teams' labeled games, if they have any; else it's a regular season
	 * game (2020's Pacific League postseason began the day the Central League's season ended).
	 */
	postseason?: NpbPostseason
	/**
	 * Today in Japan (`YYYY-MM-DD`). Postseason games before it that npb.jp never linked weren't
	 * needed (a series already won), so they're left out.
	 */
	today?: string
}): NpbSchedule {
	const sorted = months
		.flatMap((month) => month.rows)
		// Stable, so a day keeps npb.jp's order
		.sort((a, b) => a.date.localeCompare(b.date))

	/** The round each pair's labeled postseason games are in */
	const rounds = new Map<string, NpbCompetition>()
	const labeled = sorted.map((row) => {
		const mmdd = row.date.slice(5).replace('-', '')
		const label = postseason.games.get(`${mmdd}/${row.teams.home.code}-${row.teams.away.code}`)
		if (label) rounds.set(pairKey(row.teams.home.code, row.teams.away.code), label)
		return { ...row, competition: label ?? row.competition }
	})

	const rows = labeled
		.map((row) => {
			const inPostseason = postseason.start && row.date >= postseason.start
			const round = rounds.get(pairKey(row.teams.home.code, row.teams.away.code))
			return inPostseason && row.competition === 'regular' && round
				? { ...row, competition: round }
				: row
		})
		.filter(
			(row) =>
				row.competition === 'regular' ||
				row.competition === 'all-star' ||
				row.code ||
				!today ||
				row.date >= today,
		)

	/**
	 * Per pair (and round, outside the regular season): games finished (or under way), and the next
	 * number counting the ones scheduled but not played yet
	 */
	const played = new Map<string, number>()
	const scheduled = new Map<string, number>()

	/** Each team's regular season record so far, and each pair's record in a postseason round */
	const records = new Map<string, NpbRecord>()

	function withRecord(row: Omit<NpbScheduleRow, 'code'>, side: NpbSide, key: string) {
		const team = row.teams[side]
		// The All-Star sides have no record
		if (row.competition === 'all-star') return team

		const recordKey = row.competition === 'regular' ? String(team.id) : `${key}:${team.id}`
		const record = addResult(records.get(recordKey) ?? emptyRecord(), row, side)
		records.set(recordKey, record)
		return { ...team, record }
	}

	const games = rows.map(({ code, ...row }): NpbScheduleGame => {
		const pair = pairKey(row.teams.home.code, row.teams.away.code)
		const key = row.competition === 'regular' ? pair : `${row.competition}:${pair}`
		const next = Math.max(played.get(key) ?? 0, scheduled.get(key) ?? 0) + 1
		const number = Number(code?.split('-')[2] ?? next)

		if (!row.isCancelled) {
			if (row.state !== 'Preview') played.set(key, number)
			scheduled.set(key, number)
		}

		const nn = String(number).padStart(2, '0')
		return {
			...row,
			teams: { away: withRecord(row, 'away', key), home: withRecord(row, 'home', key) },
			ref: {
				season,
				date: row.date.slice(5).replace('-', ''),
				code: code ?? `${row.teams.home.code}-${row.teams.away.code}-${nn}`,
			},
			linked: !!code,
			series: { number: 0, total: 0, homeWins: 0, awayWins: 0 },
		}
	})

	numberSeries(games.filter((game) => game.competition === 'regular'))
	numberRounds(games.filter((game) => game.competition !== 'regular'))

	const allStarDates = [...new Set(months.flatMap((month) => month.allStarDates))].sort()

	return { season, games, allStarDates }
}

const DAY_MS = 86_400_000

/** More days off than this between two games at one park makes them separate series */
const SERIES_MAX_GAP_DAYS = 2

const wins = (game: NpbScheduleGame, side: NpbSide) => {
	const team = game.teams[side]
	const other = game.teams[side === 'home' ? 'away' : 'home']
	return game.state === 'Final' &&
		!game.isCancelled &&
		team.runs !== null &&
		other.runs !== null &&
		team.runs > other.runs
		? 1
		: 0
}

/**
 * Fills in each regular season game's `series`: a run of games between the same two teams at the
 * same home team, with neither playing anyone else in between.
 */
function numberSeries(games: NpbScheduleGame[]) {
	/** Each team's last game */
	const last = new Map<number, NpbScheduleGame>()
	const all: NpbScheduleGame[][] = []
	/** The open series by home team */
	const open = new Map<number, NpbScheduleGame[]>()

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
			homeWins: before.homeWins + wins(game, 'home'),
			awayWins: before.awayWins + wins(game, 'away'),
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
function numberRounds(games: NpbScheduleGame[]) {
	const rounds = new Map<string, NpbScheduleGame[]>()
	for (const game of games) {
		const key = `${game.competition}:${pairKey(game.teams.home.code, game.teams.away.code)}`
		rounds.set(key, [...(rounds.get(key) ?? []), game])
	}

	for (const round of rounds.values()) {
		const teamWins = new Map<number, number>()
		round.forEach((game, i) => {
			for (const side of ['home', 'away'] as const) {
				const { id } = game.teams[side]
				teamWins.set(id, (teamWins.get(id) ?? 0) + wins(game, side))
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
export function filterNpbSchedule(
	games: NpbScheduleGame[],
	{ startDate, endDate, teamId }: { startDate?: string; endDate?: string; teamId?: number },
) {
	return games.filter(
		(game) =>
			(!startDate || game.date >= startDate) &&
			(!endDate || game.date <= endDate) &&
			(!teamId || game.teams.home.id === teamId || game.teams.away.id === teamId),
	)
}

/** The sports with games in `season`: the Stats API's leagues', plus NPB's from npb.jp */
export function scheduleSportIds(leagues: MLB.League[], season: number | string) {
	const ids = new Set(leagues.map((league) => league.sport?.id).filter(Boolean) as number[])
	if (Number(season) >= NPB_SCHEDULE_MIN_SEASON) ids.add(NPB_SPORT_ID)
	return [...ids]
}

/** What `/api/npb/schedule/{season}` answers */
export interface NpbScheduleResponse {
	season: number
	source: string
	allStarDates: string[]
	games: NpbScheduleGame[]
}

/**
 * A season's NPB schedule from our API route, narrowed like {@link filterNpbSchedule}. A season
 * npb.jp has no schedule for comes back empty; other failures throw.
 */
export async function loadNpbSchedule(
	season: number | string,
	query: { startDate?: string; endDate?: string; teamId?: number; linescores?: boolean } = {},
	fetcher: typeof fetch = fetch,
): Promise<NpbScheduleResponse> {
	const params = new URLSearchParams(
		Object.entries(query)
			.filter(([, value]) => value !== undefined && value !== false)
			.map(([key, value]) => [key, value === true ? '1' : String(value)]),
	)
	const response = await fetcher(`/api/npb/schedule/${season}${params.size ? `?${params}` : ''}`)

	if (response.status === 404) {
		return { season: Number(season), source: '', allStarDates: [], games: [] }
	}
	if (!response.ok) throw new Error(`NPB schedule responded ${response.status}`)

	return response.json()
}
