/**
 * Parsers for an NPB game's pages on npb.jp (npb.jp/scores/{season}/{mmdd}/{home}-{away}-{nn}/):
 *
 * - The game TOP page (index.html): title, venue, times and attendance, the linescore, umpires,
 *   decisions and home runs.
 * - box.html: each side's batting lines (with a scorebook entry per inning) and pitching lines.
 * - playbyplay.html: every plate appearance by half-inning, with the outs, runners, final count
 *   and result, plus notes for pitching changes and steals. NPB has no pitch-by-pitch data.
 *
 * The pages are Japanese only. The parsers keep npb.jp's Japanese text, and the `translate*`
 * helpers below render it in English, so the page can switch languages without reloading.
 */

import { NPB_TEAM_INFO } from '#lib/npb-roster.js'
import { cellText, compact, NPB_TEAMS } from '#lib/npb.js'
import type { Notation } from '#lib/scorecard.js'

export interface NpbGameRef {
	season: number
	/** `mmdd`, e.g. `1001` */
	date: string
	/** `{home}-{away}-{nn}`, e.g. `t-g-25`: team page codes, then the game of the season series */
	code: string
}

export type NpbSide = 'away' | 'home'
export type NpbGameState = 'Preview' | 'Live' | 'Final'

export interface NpbPlayerRef {
	/** npb.jp's player ID, from the link to their page */
	id: string | null
	/** As npb.jp prints it, e.g. 大山, or 増田陸 to tell two 増田 apart */
	nameJa: string
}

export interface NpbGameTeam {
	/** MLB Stats API team ID, or `null` for a team not in `NPB_TEAMS` */
	id: number | null
	/** npb.jp's page code, e.g. `t` */
	code: string
	/** e.g. 阪神タイガース */
	nameJa: string
	/** e.g. 阪神 */
	shortNameJa: string
	name: string | null
	teamName: string | null
	abbreviation: string | null
	runs: number | null
	hits: number | null
	errors: number | null
}

export interface NpbInning {
	num: number
	/** `null` for a half not played (yet), `'X'` for the home half a winning team skips */
	away: number | 'X' | null
	home: number | 'X' | null
}

export type NpbUmpirePosition = 'HP' | '1B' | '2B' | '3B' | 'LF' | 'RF'

export interface NpbUmpire {
	position: NpbUmpirePosition
	nameJa: string
}

export interface NpbDecision {
	player: NpbPlayerRef
	/** As printed, e.g. 8勝6敗 or 3勝2敗30S */
	recordJa: string
}

export interface NpbHomeRun {
	side: NpbSide
	batter: NpbPlayerRef
	/** Season total */
	number: number
	inning: number
	/** Runners on base, 0 for a solo shot */
	runnersOn: number
	pitcher: NpbPlayerRef
}

export interface NpbBatterLine {
	/** Spot in the batting order for a starter; `null` for a substitute */
	order: number | null
	/** Positions played in order, as npb.jp's one-character codes: 打 (PH), 走 (PR), 左, … */
	positionsJa: string[]
	player: NpbPlayerRef
	atBats: number
	runs: number
	hits: number
	rbi: number
	stolenBases: number
	/** Scorebook entries by inning (index 0 is the 1st), several when the order bats around */
	innings: string[][]
}

export type NpbPitcherDecision = 'W' | 'L' | 'S' | 'H'

export interface NpbPitcherLine {
	decision: NpbPitcherDecision | null
	player: NpbPlayerRef
	pitches: number | null
	battersFaced: number
	/** Like the Stats API's, e.g. `5.0`, `0.2` */
	inningsPitched: string
	hits: number
	homeRuns: number
	baseOnBalls: number
	hitBatsmen: number
	strikeOuts: number
	wildPitches: number
	balks: number
	runs: number
	earnedRuns: number
}

export interface NpbTeamBox {
	batters: NpbBatterLine[]
	pitchers: NpbPitcherLine[]
}

export type NpbPlayEvent =
	| {
			type: 'atBat'
			outs: number
			/** Occupied bases, 1 to 3 */
			runners: number[]
			batter: NpbPlayerRef
			/** Balls and strikes before the last pitch; `null` when npb.jp leaves it blank */
			count: { balls: number; strikes: number } | null
			resultJa: string
			rbi: number
	  }
	| {
			/** A pitching change, a steal, or the starting pitcher */
			type: 'note'
			outs: number | null
			runners: number[]
			textJa: string
			players: NpbPlayerRef[]
	  }

export interface NpbHalfInning {
	inning: number
	half: 'top' | 'bottom'
	events: NpbPlayEvent[]
}

export interface NpbGame {
	ref: NpbGameRef
	/** The game TOP page on npb.jp */
	url: string
	/** ISO date */
	date: string
	/** e.g. 甲子園 */
	venueJa: string | null
	/** e.g. JERA セ・リーグ公式戦 */
	competitionJa: string | null
	/** Game of the season series between the two teams */
	seriesGameNumber: number | null
	state: NpbGameState
	/** npb.jp's status line, e.g. 試合終了, 7回裏, 中止 */
	statusJa: string | null
	/** Called off: 中止 (postponed) or ノーゲーム */
	isCancelled: boolean
	/** `HH:MM`, Japan time */
	startTime: string | null
	endTime: string | null
	/** Minutes */
	duration: number | null
	attendance: number | null
	/** The half being played, while live */
	currentInning: { num: number; half: 'top' | 'bottom' } | null
	teams: Record<NpbSide, NpbGameTeam>
	innings: NpbInning[]
	umpires: NpbUmpire[]
	decisions: { win: NpbDecision | null; loss: NpbDecision | null; save: NpbDecision | null }
	homeRuns: NpbHomeRun[]
	box: Record<NpbSide, NpbTeamBox> | null
	plays: NpbHalfInning[] | null
}

/** A player's English name and photo, from their team's npb.jp roster */
export interface NpbGamePlayerName {
	/** Surname, with the first initial when a teammate shares it, e.g. "R. Masuda" */
	short: string
	/** e.g. "Riku Masuda" */
	full: string
	photo: string | null
}

export type NpbGameData = NpbGame & {
	/** By npb.jp player ID; only players on a current roster are here */
	names: Record<string, NpbGamePlayerName>
}

/* -------------------------------------------------------------------------------------------- */
/* URLs and references                                                                           */
/* -------------------------------------------------------------------------------------------- */

const CODE_PATTERN = /^([a-z]{1,2})-([a-z]{1,2})-(\d{1,2})$/

const TEAM_BY_CODE = new Map(
	Object.entries(NPB_TEAM_INFO).map(([id, info]) => [info.code, Number(id)] as const),
)

export const isNpbGameDate = (mmdd: string) => {
	const match = mmdd.match(/^(\d{2})(\d{2})$/)
	if (!match) return false
	const [month, day] = [Number(match[1]), Number(match[2])]
	return month >= 1 && month <= 12 && day >= 1 && day <= 31
}

/** `t-g-25`: two known team codes, then the game number */
export const isNpbGameCode = (code: string) => {
	const match = code.match(CODE_PATTERN)
	return (
		!!match && TEAM_BY_CODE.has(match[1]) && TEAM_BY_CODE.has(match[2]) && match[1] !== match[2]
	)
}

export function npbGameUrl(
	{ season, date, code }: NpbGameRef,
	page: 'index' | 'box' | 'playbyplay' = 'index',
) {
	return `https://npb.jp/scores/${season}/${date}/${code}/${page === 'index' ? '' : `${page}.html`}`
}

/** Our page for the game */
export function npbGamePath({ season, date, code }: NpbGameRef) {
	return `/game/npb/${season}/${date}/${code}`
}

/** npb.jp's page for a player */
export const npbPlayerUrl = (id: string) => `https://npb.jp/bis/players/${id}.html`

/* -------------------------------------------------------------------------------------------- */
/* Parsing                                                                                       */
/* -------------------------------------------------------------------------------------------- */

const toNumber = (text: string) => {
	const value = Number(compact(text).replace(/,/g, ''))
	return Number.isFinite(value) && compact(text) !== '' ? value : null
}

/** Full-width digits to ASCII */
const halfWidth = (text: string) =>
	text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))

/** The player in a cell's link, or its text when it has none */
function playerRef(html: string): NpbPlayerRef {
	const link = html.match(/<a[^>]*href="[^"]*\/players\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/)
	if (link) return { id: link[1], nameJa: compact(cellText(link[2])) }
	return { id: null, nameJa: compact(cellText(html)) }
}

function playerRefs(html: string): NpbPlayerRef[] {
	return [...html.matchAll(/<a[^>]*href="[^"]*\/players\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g)].map(
		(m) => ({ id: m[1], nameJa: compact(cellText(m[2])) }),
	)
}

/** The game's section, between the page header and the footer */
function contents(html: string) {
	const start = html.indexOf('<div class="contents">')
	const end = html.indexOf('<footer')
	return html.slice(start === -1 ? 0 : start, end === -1 ? undefined : end)
}

const rowsOf = (html: string) => html.split(/<tr[\s>]/).slice(1)

const cellsOf = (row: string) =>
	[...row.matchAll(/<t([dh])(\s[^>]*)?>([\s\S]*?)<\/t\1>/g)].map((m) => ({
		tag: `t${m[1]}` as 'td' | 'th',
		attrs: m[2] ?? '',
		html: m[3],
	}))

function teamFromCode(
	code: string,
	nameJa?: string,
): Omit<NpbGameTeam, 'runs' | 'hits' | 'errors'> {
	const id = TEAM_BY_CODE.get(code) ?? null
	const known =
		(nameJa && NPB_TEAMS[nameJa.replace(/・/g, '')]) ||
		Object.values(NPB_TEAMS).find((team) => team.id === id)

	return {
		id: known?.id ?? id,
		code,
		nameJa: nameJa ?? '',
		shortNameJa: '',
		name: known?.name ?? null,
		teamName: known?.teamName ?? null,
		abbreviation: known?.abbreviation ?? null,
	}
}

interface Header {
	date: string
	venueJa: string | null
	competitionJa: string | null
	seriesGameNumber: number | null
	statusJa: string | null
	startTime: string | null
	endTime: string | null
	duration: number | null
	attendance: number | null
	teams: Record<NpbSide, NpbGameTeam>
	innings: NpbInning[]
}

/** The title, game info and linescore, which every page of the game repeats */
function parseHeader(html: string, ref: NpbGameRef): Header {
	const body = contents(html)
	const title = body.match(/<div class="game_tit">([\s\S]*?)<\/div>/)?.[1] ?? ''
	const heading = cellText(title.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? '').replace(/\s+/g, ' ')
	const info = cellText(body.match(/<p class="game_info">([\s\S]*?)<\/p>/)?.[1] ?? '')
	const linescore = body.match(/<table id="tablefix_ls">([\s\S]*?)<\/table>/)?.[1]

	if (!linescore) throw new Error(`No linescore found for NPB game ${ref.code}`)

	const [, home, away] = ref.code.match(CODE_PATTERN)!

	// Rows: away (top) then home (bottom); cells: team, innings, then R, H, E
	const bodyRows = linescore
		.split(/<tbody>/)[1]
		.split(/<tr class="(?:top|bottom)">/)
		.slice(1)

	const headers = cellsOf(linescore.split(/<tbody>/)[0])
	const inningCount = headers.filter((c) => /^\d+$/.test(compact(cellText(c.html)))).length

	const sides = (['away', 'home'] as const).map((side, i) => {
		const row = bodyRows[i] ?? ''
		const cells = cellsOf(row)
		const nameJa = compact(
			cellText(row.match(/<span class="hide_sp">([\s\S]*?)<\/span>/)?.[1] ?? ''),
		)
		const shortNameJa = compact(
			cellText(row.match(/<span class="hide_pc">([\s\S]*?)<\/span>/)?.[1] ?? ''),
		)
		const scores = cells.filter((c) => c.tag === 'td').map((c) => compact(cellText(c.html)))
		const totals = scores.slice(inningCount)

		const team: NpbGameTeam = {
			...teamFromCode(side === 'home' ? home : away, nameJa || undefined),
			shortNameJa,
			runs: toNumber(totals[0] ?? ''),
			hits: toNumber(totals[1] ?? ''),
			errors: toNumber(totals[2] ?? ''),
		}

		return { team, scores: scores.slice(0, inningCount) }
	})

	const inningScore = (text: string | undefined): number | 'X' | null =>
		text === undefined ? null : /^x$/i.test(text) ? 'X' : toNumber(text)

	const innings = Array.from({ length: inningCount }, (_, i) => ({
		num: i + 1,
		away: inningScore(sides[0].scores[i]),
		home: inningScore(sides[1].scores[i]),
	}))

	const time = (label: string) =>
		info.match(new RegExp(`${label}\\s*(\\d{1,2}:\\d{2})`))?.[1] ?? null
	const duration = info.match(/試合時間\s*(?:(\d+)時間)?\s*(?:(\d+)分)?/)
	const dateMatch = title.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)

	return {
		date: dateMatch
			? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
			: `${ref.season}-${ref.date.slice(0, 2)}-${ref.date.slice(2)}`,
		venueJa:
			compact(cellText(title.match(/<span class="place">([\s\S]*?)<\/span>/)?.[1] ?? '')) || null,
		competitionJa: heading.match(/【([^】]+)】/)?.[1].trim() ?? null,
		seriesGameNumber: toNumber(heading.match(/(\d+)回戦/)?.[1] ?? ''),
		statusJa: info.match(/【([^】]+)】/)?.[1].trim() ?? null,
		startTime: time('開始'),
		endTime: time('終了'),
		duration:
			duration && (duration[1] || duration[2])
				? Number(duration[1] ?? 0) * 60 + Number(duration[2] ?? 0)
				: null,
		attendance: toNumber(info.match(/入場者\s*([\d,]+)人/)?.[1] ?? ''),
		teams: { away: sides[0].team, home: sides[1].team },
		innings,
	}
}

const UMPIRE_POSITIONS: Record<string, NpbUmpirePosition> = {
	球審: 'HP',
	'塁審(一)': '1B',
	'塁審(二)': '2B',
	'塁審(三)': '3B',
	'外審(左)': 'LF',
	'外審(右)': 'RF',
}

function parseUmpires(body: string): NpbUmpire[] {
	const text = cellText(body.match(/<p class="referee_info">([\s\S]*?)<\/p>/)?.[1] ?? '')
	return text
		.split('、')
		.map((part) => compact(part).split('：'))
		.flatMap(([label, nameJa]) =>
			label && nameJa && UMPIRE_POSITIONS[label]
				? [{ position: UMPIRE_POSITIONS[label], nameJa }]
				: [],
		)
}

/** The rows of a `game_result_info` table after the given `<h4>` (or the first, untitled one) */
function resultRows(body: string, heading?: string) {
	const section = body.match(/<section class="game_result_info">([\s\S]*?)<\/section>/)?.[1] ?? ''
	const start = heading ? section.indexOf(`<h4>${heading}</h4>`) : 0
	if (start === -1) return []
	const table = section.slice(start).match(/<table>([\s\S]*?)<\/table>/)?.[1] ?? ''
	return rowsOf(table).map((row) => {
		const [th, td] = cellsOf(row)
		return { label: compact(cellText(th?.html ?? '')).replace(/[【】]/g, ''), html: td?.html ?? '' }
	})
}

function parseDecisions(body: string): NpbGame['decisions'] {
	const decisions: NpbGame['decisions'] = { win: null, loss: null, save: null }
	const keys: Record<string, keyof NpbGame['decisions']> = {
		勝投手: 'win',
		敗投手: 'loss',
		セーブ: 'save',
	}

	for (const { label, html } of resultRows(body)) {
		const key = keys[label]
		if (!key) continue
		decisions[key] = {
			player: playerRef(html),
			recordJa: compact(cellText(html).match(/（([^）]+)）/)?.[1] ?? ''),
		}
	}

	return decisions
}

const RUNNERS_ON: Record<string, number> = { ソロ: 0, '2ラン': 1, '3ラン': 2, 満塁: 3 }

function parseHomeRuns(body: string, teams: Record<NpbSide, NpbGameTeam>): NpbHomeRun[] {
	return resultRows(body, '本塁打').flatMap(({ label, html }) => {
		const side: NpbSide = label === teams.away.shortNameJa ? 'away' : 'home'
		// Each: <a>batter</a> 20号（6回ソロ <a>pitcher</a>）, separated by 、
		return [
			...html.matchAll(
				/(<a[^>]*>[\s\S]*?<\/a>)\s*(\d+)号（(\d+)回\s*(ソロ|[23２３]ラン|満塁)[^<]*(<a[^>]*>[\s\S]*?<\/a>)?[^）]*）/g,
			),
		].map((m) => ({
			side,
			batter: playerRef(m[1]),
			number: Number(m[2]),
			inning: Number(m[3]),
			runnersOn: RUNNERS_ON[halfWidth(m[4])] ?? 0,
			pitcher: m[5] ? playerRef(m[5]) : { id: null, nameJa: '' },
		}))
	})
}

function gameState(statusJa: string | null, innings: NpbInning[]): NpbGameState {
	if (statusJa && /終了|中止|ノーゲーム|コールド/.test(statusJa)) return 'Final'
	if (statusJa && /回[表裏]|試合中|中断/.test(statusJa)) return 'Live'
	if (innings.some((inning) => inning.away !== null)) return 'Live'
	return 'Preview'
}

/** Parses the game TOP page. Throws if it has no linescore. */
export function parseNpbGame(html: string, ref: NpbGameRef): NpbGame {
	const header = parseHeader(html, ref)
	const body = contents(html)
	const live = header.statusJa?.match(/(\d+)回([表裏])/)
	const state = gameState(header.statusJa, header.innings)

	return {
		ref,
		url: npbGameUrl(ref),
		...header,
		state,
		isCancelled: !!header.statusJa && /中止|ノーゲーム/.test(header.statusJa),
		currentInning:
			state === 'Live' && live
				? { num: Number(live[1]), half: live[2] === '表' ? 'top' : 'bottom' }
				: null,
		umpires: parseUmpires(body),
		decisions: parseDecisions(body),
		homeRuns: parseHomeRuns(body, header.teams),
		box: null,
		plays: null,
	}
}

/** `(左)右` → 左, 右; `打捕` → 打, 捕 */
const positionsOf = (text: string) => [...compact(text).replace(/[()（）]/g, '')]

const PITCHER_DECISIONS: Record<string, NpbPitcherDecision> = { '○': 'W', '●': 'L', S: 'S', H: 'H' }

function parseBatters(table: string): NpbBatterLine[] {
	const tbody = table.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? ''

	return rowsOf(tbody).flatMap((row) => {
		const cells = cellsOf(row)
		const playerIndex = cells.findIndex((c) => c.attrs.includes('player'))
		if (playerIndex < 1) return []

		const [atBats, runs, hits, rbi, stolenBases, ...innings] = cells
			.slice(playerIndex + 1)
			.map((c) => c.html)

		return [
			{
				order: playerIndex >= 2 ? toNumber(cellText(cells[playerIndex - 2].html)) : null,
				positionsJa: positionsOf(cellText(cells[playerIndex - 1].html)),
				player: playerRef(cells[playerIndex].html),
				atBats: toNumber(cellText(atBats ?? '')) ?? 0,
				runs: toNumber(cellText(runs ?? '')) ?? 0,
				hits: toNumber(cellText(hits ?? '')) ?? 0,
				rbi: toNumber(cellText(rbi ?? '')) ?? 0,
				stolenBases: toNumber(cellText(stolenBases ?? '')) ?? 0,
				innings: innings.map((html) =>
					cellText(html)
						.split('\n')
						.map((entry) => compact(entry))
						.filter((entry) => entry && entry !== '-'),
				),
			},
		]
	})
}

function parsePitchers(table: string): NpbPitcherLine[] {
	const tbody =
		table.match(/<tbody>([\s\S]*?)<\/tbody>\s*<tfoot>/)?.[1] ??
		table.match(/<tbody>([\s\S]*)<\/tbody>/)?.[1] ??
		''

	// Innings pitched sit in a nested table (whole innings in its th, the fraction in its td), so
	// flatten it into a single cell before splitting the row
	const flat = tbody.replace(
		/<table class="table_inning">[\s\S]*?<th>(\d*)<\/th>\s*<td>([^<]*)<\/td>[\s\S]*?<\/table>/g,
		(_, whole: string, fraction: string) => `${whole || 0}${compact(fraction) || '.0'}`,
	)

	return rowsOf(flat).flatMap((row) => {
		const cells = cellsOf(row)
		const playerIndex = cells.findIndex((c) => c.attrs.includes('player'))
		if (playerIndex < 0) return []

		const stats = cells.slice(playerIndex + 1).map((c) => compact(cellText(c.html)))
		const n = (i: number) => toNumber(stats[i] ?? '') ?? 0
		const decision = playerIndex > 0 ? compact(cellText(cells[playerIndex - 1].html)) : ''

		return [
			{
				decision: PITCHER_DECISIONS[decision] ?? null,
				player: playerRef(cells[playerIndex].html),
				pitches: toNumber(stats[0] ?? ''),
				battersFaced: n(1),
				inningsPitched: stats[2] || '0.0',
				hits: n(3),
				homeRuns: n(4),
				baseOnBalls: n(5),
				hitBatsmen: n(6),
				strikeOuts: n(7),
				wildPitches: n(8),
				balks: n(9),
				runs: n(10),
				earnedRuns: n(11),
			},
		]
	})
}

/** Parses box.html into each side's batting and pitching lines */
export function parseNpbBox(html: string): Record<NpbSide, NpbTeamBox> {
	const body = contents(html)
	const table = (id: string) =>
		body.match(new RegExp(`<table id="${id}">([\\s\\S]*?)</table>\\s*</div>`))?.[1] ?? ''

	const box = {
		away: {
			batters: parseBatters(table('tablefix_t_b')),
			pitchers: parsePitchers(table('tablefix_t_p')),
		},
		home: {
			batters: parseBatters(table('tablefix_b_b')),
			pitchers: parsePitchers(table('tablefix_b_p')),
		},
	}

	if (!box.away.batters.length && !box.home.batters.length) {
		throw new Error('No NPB box score tables found')
	}

	return box
}

/** `1・2塁` → 1, 2; `満塁` → 1, 2, 3 */
export function parseRunners(text: string): number[] {
	const value = compact(text)
	if (value === '満塁') return [1, 2, 3]
	return [...value.replace(/塁$/, '').matchAll(/[1-3１-３]/g)].map((m) => Number(halfWidth(m[0])))
}

/** Parses playbyplay.html into half-innings of plate appearances and notes */
export function parseNpbPlays(html: string): NpbHalfInning[] {
	const progress = contents(html).match(/<div id="progress">([\s\S]*)/)?.[1] ?? ''
	const halves: NpbHalfInning[] = []

	for (const chunk of progress.split(/<h5[^>]*>/).slice(1)) {
		const heading = compact(cellText(chunk.slice(0, chunk.indexOf('</h5>'))))
		const match = heading.match(/(\d+)回([表裏])/)
		if (!match) continue

		const half: NpbHalfInning = {
			inning: Number(match[1]),
			half: match[2] === '表' ? 'top' : 'bottom',
			events: [],
		}

		for (const row of rowsOf(chunk.slice(chunk.indexOf('</h5>')))) {
			const cells = cellsOf(row).filter((c) => c.tag === 'td')
			if (!cells.length) continue

			if (cells.length === 1) {
				const textJa = cellText(cells[0].html).replace(/\s+/g, ' ').trim()
				if (textJa) {
					half.events.push({
						type: 'note',
						outs: null,
						runners: [],
						textJa,
						players: playerRefs(cells[0].html),
					})
				}
				continue
			}

			const [outsCell, runnersCell, batterCell, countCell, resultCell] = cells
			const outs = toNumber(cellText(outsCell.html).replace('アウト', '')) ?? 0
			const runners = parseRunners(cellText(runnersCell?.html ?? ''))
			const resultJa = cellText(resultCell?.html ?? '')
				.replace(/\s+/g, ' ')
				.trim()
			const batter = playerRef(batterCell?.html ?? '')

			if (!batter.nameJa) {
				half.events.push({
					type: 'note',
					outs,
					runners,
					textJa: resultJa,
					players: playerRefs(resultCell?.html ?? ''),
				})
				continue
			}

			const count = halfWidth(cellText(countCell?.html ?? '')).match(/(\d)-(\d)/)

			half.events.push({
				type: 'atBat',
				outs,
				runners,
				batter,
				count: count ? { balls: Number(count[1]), strikes: Number(count[2]) } : null,
				resultJa,
				rbi: Number(halfWidth(resultJa).match(/打点(\d+)/)?.[1] ?? 0),
			})
		}

		halves.push(half)
	}

	return halves
}

/* -------------------------------------------------------------------------------------------- */
/* English                                                                                       */
/* -------------------------------------------------------------------------------------------- */

export type NpbLang = 'en' | 'ja'

const POSITIONS: Record<string, string> = {
	投: 'P',
	捕: 'C',
	一: '1B',
	二: '2B',
	三: '3B',
	遊: 'SS',
	左: 'LF',
	中: 'CF',
	右: 'RF',
	指: 'DH',
	打: 'PH',
	走: 'PR',
}

/** 打捕 → PH-C */
export function translatePositions(positionsJa: string[]) {
	return positionsJa.map((p) => POSITIONS[p] ?? p).join('-')
}

const UMPIRE_TITLES: Record<NpbUmpirePosition, string> = {
	HP: 'Home Plate',
	'1B': 'First Base',
	'2B': 'Second Base',
	'3B': 'Third Base',
	LF: 'Left Field',
	RF: 'Right Field',
}

export const umpireTitle = (position: NpbUmpirePosition) => UMPIRE_TITLES[position]

const VENUES: Record<string, string> = {
	甲子園: 'Koshien Stadium',
	東京ドーム: 'Tokyo Dome',
	神宮: 'Meiji Jingu Stadium',
	横浜: 'Yokohama Stadium',
	バンテリンドーム: 'Vantelin Dome Nagoya',
	マツダスタジアム: 'Mazda Stadium',
	みずほPayPay: 'Mizuho PayPay Dome',
	エスコンフィールド: 'ES CON Field Hokkaido',
	京セラD大阪: 'Kyocera Dome Osaka',
	ほっと神戸: 'Hotto Motto Field Kobe',
	楽天モバイル: 'Rakuten Mobile Park Miyagi',
	ベルーナドーム: 'Belluna Dome',
	ZOZOマリン: 'ZOZO Marine Stadium',
}

export const translateVenue = (venueJa: string) => VENUES[venueJa] ?? venueJa

/** `JERA セ・リーグ公式戦` → Central League; npb.jp names the sponsor first */
export function translateCompetition(competitionJa: string) {
	if (/交流戦/.test(competitionJa)) return 'Interleague'
	if (/セ・リーグ/.test(competitionJa)) return 'Central League'
	if (/パ・リーグ/.test(competitionJa)) return 'Pacific League'
	if (/クライマックス/.test(competitionJa)) return 'Climax Series'
	if (/日本シリーズ/.test(competitionJa)) return 'Japan Series'
	if (/オープン戦/.test(competitionJa)) return 'Preseason'
	return competitionJa
}

export function translateStatus(statusJa: string) {
	if (/試合終了/.test(statusJa)) return 'Final'
	if (/コールド/.test(statusJa)) return 'Final (called)'
	if (/中止/.test(statusJa)) return 'Postponed'
	if (/ノーゲーム/.test(statusJa)) return 'No game'
	if (/中断/.test(statusJa)) return 'Delayed'
	if (/試合前|見どころ/.test(statusJa)) return 'Scheduled'
	const live = statusJa.match(/(\d+)回([表裏])/)
	if (live) return `${live[2] === '表' ? 'Top' : 'Bot'} ${live[1]}`
	return statusJa
}

/** 8勝6敗 → 8-6; 3勝2敗30S → 3-2, 30 SV */
export function translateRecord(recordJa: string) {
	const match = halfWidth(recordJa).match(/(\d+)勝(\d+)敗(?:(\d+)S)?/)
	if (!match) return recordJa
	return `${match[1]}-${match[2]}${match[3] ? `, ${match[3]} SV` : ''}`
}

const FIELDERS: [string, string][] = [
	['ピッチャー', 'pitcher'],
	['キャッチャー', 'catcher'],
	['ファースト', 'first'],
	['セカンド', 'second'],
	['サード', 'third'],
	['ショート', 'shortstop'],
	['左中間', 'left-center'],
	['右中間', 'right-center'],
	['レフト', 'left'],
	['センター', 'center'],
	['ライト', 'right'],
]

/** Outcomes after a fielder, longest first so タイムリーヒット isn't read as ヒット */
const OUTCOMES: [string, string][] = [
	['内野安打', 'Infield single'],
	['バントヒット', 'Bunt single'],
	['タイムリーヒット', 'RBI single'],
	['タイムリーツーベース', 'RBI double'],
	['タイムリースリーベース', 'RBI triple'],
	['タイムリーエラー', 'Run-scoring error'],
	['満塁ホームラン', 'Grand slam'],
	['ランニングホームラン', 'Inside-the-park home run'],
	['ソロホームラン', 'Solo home run'],
	['2ランホームラン', '2-run home run'],
	['3ランホームラン', '3-run home run'],
	['ホームラン', 'Home run'],
	['ツーベース', 'Double'],
	['スリーベース', 'Triple'],
	['ヒット', 'Single'],
	['犠牲フライ', 'Sacrifice fly'],
	['犠牲バント', 'Sacrifice bunt'],
	['ファウルフライ', 'Foul flyout'],
	['ゴロ併殺打', 'Grounds into a double play'],
	['ライナー併殺打', 'Lines into a double play'],
	['フライ併殺打', 'Flies into a double play'],
	['併殺打', 'Grounds into a double play'],
	['ゴロ', 'Groundout'],
	['フライ', 'Flyout'],
	['ライナー', 'Lineout'],
	['エラー', 'Reaches on an error'],
	['悪送球', 'Reaches on a throwing error'],
	['野選', "Fielder's choice"],
	['バント', 'Bunt'],
]

const WHOLE: Record<string, string> = {
	空振り三振: 'Strikeout swinging',
	見逃し三振: 'Called strikeout',
	三振: 'Strikeout',
	振り逃げ: 'Strikeout, reaches on a dropped third strike',
	フォアボール: 'Walk',
	敬遠フォアボール: 'Intentional walk',
	デッドボール: 'Hit by pitch',
	打撃妨害: "Catcher's interference",
	守備妨害: 'Interference',
}

const BASES: Record<string, string> = { 二: '2nd', 三: '3rd', 本: 'home' }

const RUNNER_EVENTS: [RegExp, (base: string) => string][] = [
	[/^(.)塁盗塁成功$/, (base) => `steals ${base}`],
	[/^(.)塁盗塁失敗$/, (base) => `caught stealing ${base}`],
	[/^重盗成功$/, () => 'double steal'],
	[/^牽制死$/, () => 'picked off'],
	[/^(.)塁けん制アウト$/, (base) => `picked off at ${base}`],
	[/^暴投$/, () => 'advances on a wild pitch'],
	[/^捕逸$/, () => 'advances on a passed ball'],
	[/^ボーク$/, () => 'advances on a balk'],
]

/**
 * A play-by-play result in English, e.g. センター前タイムリーヒット（打点1） → "RBI single to
 * center, 1 RBI". Anything not recognized is returned as is.
 */
export function translatePlay(
	textJa: string,
	names: (player: NpbPlayerRef) => string,
	players: NpbPlayerRef[] = [],
) {
	let text = halfWidth(textJa).replace(/\s+/g, ' ').trim()

	const named = (nameJa: string) => {
		const player = players.find((p) => p.nameJa === compact(nameJa))
		return player ? names(player) : nameJa
	}

	// Notes
	const starter = text.match(/^（先発投手）\s*(.+)$/)
	if (starter) return `Starting pitcher: ${named(starter[1])}`

	const change = text.match(/^（(投手交代|代打|代走|守備交代|守備位置変更)）\s*(.+?)\s*→\s*(.+)$/)
	if (change) {
		const label =
			{ 投手交代: 'Pitching change', 代打: 'Pinch hitter', 代走: 'Pinch runner' }[change[1]] ??
			'Defensive substitution'
		return `${label}: ${named(change[2])} → ${named(change[3])}`
	}

	const runner = text.match(/^（走者・(.+?)）(.+)$/)
	if (runner) {
		const event = RUNNER_EVENTS.find(([pattern]) => pattern.test(runner[2]))
		if (event) {
			const base = runner[2].match(event[0])?.[1]
			return `${named(runner[1])} ${event[1](BASES[base ?? ''] ?? base ?? '')}`
		}
		return `${named(runner[1])}: ${runner[2]}`
	}

	// Plate appearances
	const rbi = Number(text.match(/（打点(\d+)）/)?.[1] ?? 0)
	const fc = /（フィールダースチョイス）/.test(text)
	text = text.replace(/（打点\d+）|（フィールダースチョイス）/g, '').trim()

	const suffix = `${fc ? ", fielder's choice" : ''}${rbi ? `, ${rbi} RBI` : ''}`

	if (WHOLE[text]) return `${WHOLE[text]}${suffix}`

	const fielder = FIELDERS.find(([ja]) => text.startsWith(ja))
	let rest = fielder ? text.slice(fielder[0].length) : text
	let where = fielder?.[1]

	if (fielder && rest.startsWith('線')) {
		where = `down the ${fielder[1]}-field line`
		rest = rest.slice(1)
	} else if (fielder && rest.startsWith('前')) {
		rest = rest.slice(1)
	} else if (fielder && rest.startsWith('オーバー')) {
		where = `over the ${fielder[1]} fielder`
		rest = rest.slice(4)
	}

	const outcome = OUTCOMES.find(([ja]) => rest === ja)
	if (!outcome) return textJa

	const preposition = where?.startsWith('down') || where?.startsWith('over') ? ' ' : ' to '
	return `${outcome[1]}${where ? `${preposition}${where}` : ''}${suffix}`
}

const FIELD_NUMBERS: Record<string, number> = {
	投: 1,
	捕: 2,
	一: 3,
	二: 4,
	三: 5,
	遊: 6,
	左: 7,
	中: 8,
	右: 9,
}

const CIRCLED = '①②③④'

/**
 * A box score scorebook entry in scorer's notation, e.g. 右前安① → 1B with 1 RBI, 二ゴロ → G4,
 * 三併打 → G5 (DP). Unrecognized entries keep their Japanese label.
 */
export function scorebookNotation(entryJa: string): Notation & { rbi: number } {
	let entry = halfWidth(compact(entryJa))
	const rbiChar = [...entry].find((c) => CIRCLED.includes(c))
	const rbi = rbiChar ? CIRCLED.indexOf(rbiChar) + 1 : 0
	entry = entry.replace(/[①②③④]/g, '')

	const whole: Record<string, Notation> = {
		三振: { label: 'K', kind: 'strikeout' },
		振逃: { label: 'K', kind: 'strikeout' },
		四球: { label: 'BB', kind: 'walk', bases: 1 },
		敬遠四: { label: 'IBB', kind: 'walk', bases: 1 },
		死球: { label: 'HBP', kind: 'walk', bases: 1 },
		打妨: { label: 'CI', kind: 'other', bases: 1 },
	}
	if (whole[entry]) return { ...whole[entry], rbi }

	const fielder = FIELD_NUMBERS[entry[0]]
	const rest = entry.replace(/^[投捕一二三遊左中右]+/, '').replace(/^[前線越]/, '')

	const hit: Record<string, Notation> = {
		安: { label: '1B', kind: 'hit', bases: 1 },
		'2': { label: '2B', kind: 'hit', bases: 2 },
		'3': { label: '3B', kind: 'hit', bases: 3 },
		本: { label: 'HR', kind: 'homeRun', bases: 4 },
	}
	if (hit[rest]) return { ...hit[rest], rbi }

	const n = fielder ?? ''
	const outs: Record<string, Notation> = {
		ゴロ: { label: `G${n}`, kind: 'out' },
		飛: { label: `F${n}`, kind: 'out' },
		邪飛: { label: `F${n}`, kind: 'out' },
		直: { label: `L${n}`, kind: 'out' },
		犠打: { label: 'SAC', kind: 'out' },
		犠飛: { label: 'SF', kind: 'out' },
		併打: { label: `G${n}`, kind: 'out', badge: 'DP' },
		併殺: { label: `G${n}`, kind: 'out', badge: 'DP' },
		野選: { label: 'FC', kind: 'fieldersChoice', bases: 1 },
		失: { label: `E${n}`, kind: 'error', bases: 1 },
		犠失: { label: `E${n}`, kind: 'error', bases: 1 },
	}
	if (outs[rest]) return { ...outs[rest], rbi }

	return { label: entryJa, kind: 'other', rbi }
}

export type NpbScorecardCell = ReturnType<typeof scorebookNotation> & {
	/** As npb.jp writes it, e.g. 右前安① */
	entryJa: string
	/** The out the batter made, 1 to 3 */
	out?: number
	/** The batter came around to score; only known for a home run */
	scored: boolean
	/** The play-by-play's result, e.g. センター前ヒット */
	resultJa?: string
}

/**
 * A side's scorecard: each batting line's box score entries by inning, matched in order to the
 * batter's plate appearances in the play-by-play for the outs before each one.
 */
export function npbScorecard(
	batters: NpbBatterLine[],
	plays: NpbHalfInning[] | null,
	side: NpbSide,
): NpbScorecardCell[][][] {
	const half = side === 'away' ? 'top' : 'bottom'
	const atBats = new Map<string, Extract<NpbPlayEvent, { type: 'atBat' }>[]>()

	for (const { inning, half: h, events } of plays ?? []) {
		if (h !== half) continue
		for (const event of events) {
			if (event.type !== 'atBat' || !event.batter.id) continue
			const key = `${inning}-${event.batter.id}`
			atBats.set(key, [...(atBats.get(key) ?? []), event])
		}
	}

	return batters.map((line) =>
		line.innings.map((entries, i) =>
			entries.map((entryJa, j) => {
				const notation = scorebookNotation(entryJa)
				const event = line.player.id ? atBats.get(`${i + 1}-${line.player.id}`)?.[j] : undefined
				const madeOut = notation.kind === 'out' || notation.kind === 'strikeout'

				return {
					...notation,
					entryJa,
					out:
						madeOut && event
							? Math.min(3, event.outs + (notation.badge === 'DP' ? 2 : 1))
							: undefined,
					scored: notation.kind === 'homeRun',
					resultJa: event?.resultJa,
				}
			}),
		),
	)
}
