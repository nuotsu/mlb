/**
 * Parsers for NPB's season schedule on npb.jp:
 *
 * - The monthly detail pages (npb.jp/games/{season}/schedule_{MM}_detail.html) list every game:
 *   the date, home and away teams (home first), venue, start time, then the score and W/L (or
 *   tie) pitchers once played, or the probable starters the day before. Postseason games are
 *   listed too, with nothing to tell them apart, and All-Star games as セ・リーグ vs パ・リーグ.
 * - The English calendar (npb.jp/bis/eng/{season}/calendar/index_{MM}.html) labels the
 *   Climax Series, Nippon Series and All-Star games, which is how the postseason gets left out.
 *
 * A game's page code (`{home}-{away}-{nn}`) is only linked once the game has started. `nn` is the
 * game of the season series between the two teams: one more than the games they have finished
 * (called-off games don't count), so it's worked out for the games not linked yet.
 */

import type { NpbGameRef, NpbGameState, NpbSide } from '#lib/npb-game.js'
import { NPB_TEAM_INFO } from '#lib/npb-roster.js'
import { cellText, compact, NPB_SPORT_ID, type NpbRecord } from '#lib/npb.js'

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
	/** The team's season record after this game, like the Stats API's `leagueRecord` */
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

export interface NpbScheduleGame {
	ref: NpbGameRef
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
}

export interface NpbSchedule {
	season: number
	/** Regular season and interleague games, in order */
	games: NpbScheduleGame[]
	/** All-Star games, which split the season like MLB's break */
	allStarDates: string[]
}

/** A row of a detail page, before the postseason is told apart and codes are worked out */
export interface NpbScheduleRow extends Omit<NpbScheduleGame, 'ref' | 'linked'> {
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

const ALL_STAR_TEAMS = new Set(['セ・リーグ', 'パ・リーグ'])

const div = (html: string, className: string) =>
	html.match(new RegExp(`<div class="${className}">([\\s\\S]*?)</div>`))?.[1]

const text = (html: string | undefined) => (html === undefined ? '' : compact(cellText(html)))

function team(shortNameJa: string, runs: string): Omit<NpbScheduleTeam, 'code' | 'record'> | null {
	const id = TEAM_BY_SHORT_NAME[shortNameJa]
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
 * Every game on one month's detail page, home team first in each row as npb.jp lists them.
 * All-Star games come back in `allStarDates` instead.
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
		if (ALL_STAR_TEAMS.has(home) || ALL_STAR_TEAMS.has(away)) {
			allStarDates.add(date)
			continue
		}

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
			date,
			teams: {
				away: { ...teams.away, code: NPB_TEAM_INFO[teams.away.id].code, record: null },
				home: { ...teams.home, code: NPB_TEAM_INFO[teams.home.id].code, record: null },
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
	/** `{mmdd}/{home}-{away}`, e.g. `1010/g-db` */
	games: Set<string>
}

/**
 * The month's Climax Series and Nippon Series games on the English calendar. Played games link to
 * their page (`G 1 - 2 DB`); scheduled ones are plain text (`DB - G 14:00`). Either way the home
 * team comes first, and the date from the day's cell.
 */
export function parseNpbPostseason(html: string, season: number, month: number): NpbPostseason {
	const postseason: NpbPostseason = { start: null, games: new Set() }

	for (const cell of html.split(/<td class="stschedule"/).slice(1)) {
		const day = cell.match(/<div class="teschedate">(?:<a[^>]*>)?(\d{1,2})/)?.[1]
		if (!day) continue

		for (const m of cell.matchAll(
			/<div class="tescheaten">([^<]*)<\/div>\s*<div>([\s\S]*?)<\/div>/g,
		)) {
			if (!/Climax|CS|Nippon|Japan Series/i.test(m[1])) continue

			const teams = cellText(m[2]).match(/^([A-Z]+)\b.*?\b([A-Z]+)(?:\s+\d{1,2}:\d{2})?$/)
			if (!teams) continue

			postseason.start ??= `${season}-${pad(month)}-${day.padStart(2, '0')}`
			postseason.games.add(
				`${pad(month)}${day.padStart(2, '0')}/${teams[1].toLowerCase()}-${teams[2].toLowerCase()}`,
			)
		}
	}

	return postseason
}

const pairKey = (a: string, b: string) => [a, b].sort().join('-')

/**
 * The season's regular season games from its months' rows: postseason games dropped, and a page
 * code for each, from npb.jp's link or else the season series so far.
 */
export function buildNpbSchedule({
	season,
	months,
	postseason = { start: null, games: new Set() },
}: {
	season: number
	months: ReturnType<typeof parseNpbScheduleMonth>[]
	/**
	 * From {@link parseNpbPostseason}: its games are left out, and so are games from its first day
	 * on that npb.jp never linked, like Nippon Series games that turned out not to be needed.
	 * (2020's Pacific League postseason began the day the Central League's season ended.)
	 */
	postseason?: NpbPostseason
}): NpbSchedule {
	const rows = months
		.flatMap((month) => month.rows)
		.filter((row) => {
			const mmdd = row.date.slice(5).replace('-', '')
			if (postseason.games.has(`${mmdd}/${row.teams.home.code}-${row.teams.away.code}`)) {
				return false
			}
			return !postseason.start || row.date < postseason.start || !!row.code
		})
		// Stable, so a day keeps npb.jp's order
		.sort((a, b) => a.date.localeCompare(b.date))

	/** Games each pair has finished (or is playing) so far, ties included */
	const played = new Map<string, number>()
	/** Per pair: the next game number, counting the scheduled games not yet played */
	const scheduled = new Map<string, number>()

	/** Each team's record so far, by team ID */
	const records = new Map<number, NpbRecord>()

	function withRecord(row: Omit<NpbScheduleRow, 'code'>, side: NpbSide): NpbScheduleTeam {
		const team = row.teams[side]
		const other = row.teams[side === 'home' ? 'away' : 'home']
		const record = { ...(records.get(team.id) ?? { wins: 0, losses: 0, ties: 0 }) }

		if (row.state === 'Final' && !row.isCancelled && team.runs !== null && other.runs !== null) {
			if (team.runs > other.runs) record.wins++
			else if (team.runs < other.runs) record.losses++
			else record.ties++
		}

		records.set(team.id, record)
		return { ...team, record }
	}

	const games = rows.map(({ code, ...row }): NpbScheduleGame => {
		const pair = pairKey(row.teams.home.code, row.teams.away.code)
		const next = Math.max(played.get(pair) ?? 0, scheduled.get(pair) ?? 0) + 1
		const number = Number(code?.split('-')[2] ?? next)

		if (!row.isCancelled) {
			if (row.state !== 'Preview') played.set(pair, number)
			scheduled.set(pair, number)
		}

		const nn = String(number).padStart(2, '0')
		return {
			...row,
			teams: { away: withRecord(row, 'away'), home: withRecord(row, 'home') },
			ref: {
				season,
				date: row.date.slice(5).replace('-', ''),
				code: code ?? `${row.teams.home.code}-${row.teams.away.code}-${nn}`,
			},
			linked: !!code,
		}
	})

	const allStarDates = [...new Set(months.flatMap((month) => month.allStarDates))].sort()

	return { season, games, allStarDates }
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
	query: { startDate?: string; endDate?: string; teamId?: number } = {},
	fetcher: typeof fetch = fetch,
): Promise<NpbScheduleResponse> {
	const params = new URLSearchParams(
		Object.entries(query)
			.filter(([, value]) => value !== undefined)
			.map(([key, value]) => [key, String(value)]),
	)
	const response = await fetcher(`/api/npb/schedule/${season}${params.size ? `?${params}` : ''}`)

	if (response.status === 404) {
		return { season: Number(season), source: '', allStarDates: [], games: [] }
	}
	if (!response.ok) throw new Error(`NPB schedule responded ${response.status}`)

	return response.json()
}
