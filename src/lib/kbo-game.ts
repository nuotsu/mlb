/**
 * Parsers for a KBO game on koreabaseball.com, from the JSON web services its game center
 * (Schedule/GameCenter/Main.aspx) calls:
 *
 * - `Main.asmx/GetKboGameList` lists a day's games: state, inning, count and runners while live,
 *   starters, winning and losing pitchers, venue, start time, and each game's series (`SR_ID`),
 *   which the other two need.
 * - `Schedule.asmx/GetScoreBoardScroll` has a game's linescore, R/H/E/B, both teams' records,
 *   the crowd, and start, end and running time.
 * - `Schedule.asmx/GetBoxScoreScroll` has the box score: each batter's line and result by inning,
 *   each pitcher's line, and notes (home runs, doubles, errors, steals, umpires and so on).
 *
 * There's no play-by-play; the plays are put together from the batters' results by inning.
 * Player names are KBO's, in Korean; the English site has no box scores or full rosters.
 *
 * Shipping this needs KBO's prior approval: koreabaseball.com prohibits automated collection of
 * its data without it (see `kbo.ts`).
 */

import { kboGrid, kboGridText, kboTeamByCode, type KboRecord } from '#lib/kbo.js'
import type { Notation } from '#lib/scorecard.js'

export type KboSide = 'away' | 'home'
export type KboGameState = 'Preview' | 'Live' | 'Final'

/** What a game is part of: the season, a postseason round, or the All-Star Game */
export type KboCompetition =
	'regular' | 'wild-card' | 'semi-playoff' | 'playoff' | 'korean-series' | 'all-star'

/** koreabaseball.com's series IDs (`SR_ID`); 6 is a tiebreaker, counted with the season */
export const KBO_SERIES_IDS: Record<number, KboCompetition> = {
	0: 'regular',
	6: 'regular',
	4: 'wild-card',
	3: 'semi-playoff',
	5: 'playoff',
	7: 'korean-series',
	9: 'all-star',
}

export const KBO_SERIES_ID_BY_COMPETITION: Record<KboCompetition, number> = {
	regular: 0,
	'wild-card': 4,
	'semi-playoff': 3,
	playoff: 5,
	'korean-series': 7,
	'all-star': 9,
}

export interface KboPlayerRef {
	nameKo: string
	/** koreabaseball.com's player ID, when known */
	id: string | null
}

/* -------------------------------------------------------------------------------------------- */
/* Game IDs                                                                                      */
/* -------------------------------------------------------------------------------------------- */

/**
 * koreabaseball.com's game ID: date, away and home team codes, then 0, or 1 and 2 for a
 * doubleheader's games, e.g. `20261001NCOB0` (NC at Doosan, Oct 1, 2026). The All-Star Game's
 * sides are `WE` (나눔) and `EA` (드림).
 */
const GAME_ID = /^(\d{4})(\d{2})(\d{2})([A-Z]{2})([A-Z]{2})(\d)$/

export interface KboGameId {
	season: number
	/** ISO date */
	date: string
	away: string
	home: string
	/** 0, or a doubleheader's 1 and 2 */
	number: number
}

export function parseKboGameId(id: string): KboGameId | null {
	const parts = id.match(GAME_ID)
	if (!parts) return null
	const [, year, month, day, away, home, number] = parts
	if (away === home || !kboTeamByCode(away) || !kboTeamByCode(home)) return null
	return {
		season: Number(year),
		date: `${year}-${month}-${day}`,
		away,
		home,
		number: Number(number),
	}
}

export const kboGamePath = (id: string) => `/game/kbo/${id}`

/** The game on koreabaseball.com's game center */
export function kboGameCenterUrl(id: string) {
	const date = id.slice(0, 8)
	return `https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${date}&gameId=${id}&section=REVIEW`
}

/* -------------------------------------------------------------------------------------------- */
/* A day's games (GetKboGameList)                                                                */
/* -------------------------------------------------------------------------------------------- */

/** A game as the day's game list has it */
export interface KboGameSummary {
	id: string
	/** koreabaseball.com's series ID, which its scoreboard and box score need */
	seriesId: number
	competition: KboCompetition
	/** ISO date */
	date: string
	/** `HH:MM`, Korea time */
	startTime: string | null
	venueKo: string | null
	state: KboGameState
	isCancelled: boolean
	/** Why it was called off, e.g. 우천취소 (rain) */
	cancelReasonKo: string | null
	currentInning: { num: number; half: 'top' | 'bottom' } | null
	count: { balls: number; strikes: number; outs: number } | null
	/** Occupied bases, 1 to 3, while live */
	runners: number[]
	runs: Record<KboSide, number | null>
	starters: Record<KboSide, KboPlayerRef | null>
	decisions: Record<'win' | 'loss' | 'save', KboPlayerRef | null>
	/**
	 * The game's number: between the two teams this season, or in a postseason round, e.g. 4 for
	 * the Korean Series' fourth game
	 */
	gameNumber: number | null
	/** Broadcasters, e.g. SBS SPORTS,SPOTV */
	tv: string | null
}

/** One game in GetKboGameList's `game` array (the fields read here) */
export interface KboGameListItem {
	G_ID: string
	SR_ID: number
	G_DT: string
	G_TM: string | null
	S_NM: string | null
	GAME_STATE_SC: string | null
	CANCEL_SC_ID: string | null
	CANCEL_SC_NM: string | null
	GAME_INN_NO: number | null
	GAME_TB_SC: string | null
	T_SCORE_CN: string | number | null
	B_SCORE_CN: string | number | null
	BALL_CN: number | null
	STRIKE_CN: number | null
	OUT_CN: number | null
	B1_BAT_ORDER_NO: number | null
	B2_BAT_ORDER_NO: number | null
	B3_BAT_ORDER_NO: number | null
	T_PIT_P_ID: number | null
	T_PIT_P_NM: string | null
	B_PIT_P_ID: number | null
	B_PIT_P_NM: string | null
	W_PIT_P_ID: number | null
	W_PIT_P_NM: string | null
	L_PIT_P_ID: number | null
	L_PIT_P_NM: string | null
	SV_PIT_P_ID: number | null
	SV_PIT_P_NM: string | null
	VS_GAME_CN: number | null
	TV_IF: string | null
}

const person = (id: number | null, name: string | null): KboPlayerRef | null => {
	const nameKo = name?.trim()
	return nameKo ? { nameKo, id: id ? String(id) : null } : null
}

const score = (value: string | number | null) =>
	value === null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value)

/**
 * `GAME_STATE_SC`: 1 before the game, 2 under way, 3 over, 4 called off (with `CANCEL_SC_NM`'s
 * reason); anything else (a suspended game) counts as under way.
 */
function state(item: KboGameListItem): { state: KboGameState; isCancelled: boolean } {
	const cancelled = (item.CANCEL_SC_ID ?? '0') !== '0' || item.GAME_STATE_SC === '4'
	if (cancelled) return { state: 'Final', isCancelled: true }
	if (item.GAME_STATE_SC === '3') return { state: 'Final', isCancelled: false }
	if (item.GAME_STATE_SC === '1' || !item.GAME_STATE_SC) {
		return { state: 'Preview', isCancelled: false }
	}
	return { state: 'Live', isCancelled: false }
}

export function parseKboGameList(json: { game?: KboGameListItem[] | null }): KboGameSummary[] {
	return (json.game ?? []).flatMap((item): KboGameSummary[] => {
		const id = parseKboGameId(item.G_ID)
		if (!id) return []

		const { state: gameState, isCancelled } = state(item)
		const live = gameState === 'Live'

		return [
			{
				id: item.G_ID,
				seriesId: item.SR_ID,
				competition: KBO_SERIES_IDS[item.SR_ID] ?? 'regular',
				date: id.date,
				startTime: item.G_TM?.match(/^\d{1,2}:\d{2}$/)?.[0].padStart(5, '0') ?? null,
				venueKo: item.S_NM?.trim() || null,
				state: gameState,
				isCancelled,
				cancelReasonKo: isCancelled ? item.CANCEL_SC_NM?.trim() || null : null,
				currentInning:
					live && item.GAME_INN_NO
						? { num: item.GAME_INN_NO, half: item.GAME_TB_SC === 'B' ? 'bottom' : 'top' }
						: null,
				count: live
					? {
							balls: item.BALL_CN ?? 0,
							strikes: item.STRIKE_CN ?? 0,
							outs: item.OUT_CN ?? 0,
						}
					: null,
				runners: live
					? [item.B1_BAT_ORDER_NO, item.B2_BAT_ORDER_NO, item.B3_BAT_ORDER_NO].flatMap(
							(order, i) => (order ? [i + 1] : []),
						)
					: [],
				runs:
					gameState === 'Preview' || isCancelled
						? { away: null, home: null }
						: { away: score(item.T_SCORE_CN), home: score(item.B_SCORE_CN) },
				starters: {
					away: person(item.T_PIT_P_ID, item.T_PIT_P_NM),
					home: person(item.B_PIT_P_ID, item.B_PIT_P_NM),
				},
				decisions: {
					win: gameState === 'Final' ? person(item.W_PIT_P_ID, item.W_PIT_P_NM) : null,
					loss: gameState === 'Final' ? person(item.L_PIT_P_ID, item.L_PIT_P_NM) : null,
					save: gameState === 'Final' ? person(item.SV_PIT_P_ID, item.SV_PIT_P_NM) : null,
				},
				gameNumber: item.VS_GAME_CN || null,
				tv: item.TV_IF?.trim() || null,
			},
		]
	})
}

/* -------------------------------------------------------------------------------------------- */
/* Scoreboard (GetScoreBoardScroll)                                                              */
/* -------------------------------------------------------------------------------------------- */

export interface KboInning {
	num: number
	/** `null` for a half not played (yet) */
	away: number | null
	home: number | null
}

export interface KboLineTeam {
	runs: number | null
	hits: number | null
	errors: number | null
	/** Walks and hit batters, KBO's B column */
	walks: number | null
}

export interface KboScoreboard {
	innings: KboInning[]
	teams: Record<KboSide, KboLineTeam>
	/**
	 * Each team's record after the game: the season's, or in a postseason round, the round's.
	 * `null` for the All-Star sides.
	 */
	records: Record<KboSide, KboRecord | null>
	attendance: number | null
	/** `HH:MM`, Korea time */
	startTime: string | null
	endTime: string | null
	/** Minutes */
	duration: number | null
	venueKo: string | null
}

export interface KboScoreboardResponse {
	code?: string
	S_NM?: string | null
	CROWD_CN?: string | null
	START_TM?: string | null
	END_TM?: string | null
	USE_TM?: string | null
	H_W_CN?: number | null
	H_L_CN?: number | null
	H_D_CN?: number | null
	A_W_CN?: number | null
	A_L_CN?: number | null
	A_D_CN?: number | null
	table2?: string | null
	table3?: string | null
}

const numberOrNull = (text: string | null | undefined) => {
	const value = text?.replace(/,/g, '').trim()
	return value && /^\d+$/.test(value) ? Number(value) : null
}

/** "3:24" → 204 minutes */
const minutes = (text: string | null | undefined) => {
	const match = text?.match(/^(\d+):(\d{2})$/)
	return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

const time = (text: string | null | undefined) =>
	text?.match(/^\d{1,2}:\d{2}$/)?.[0].padStart(5, '0') ?? null

/**
 * The scoreboard. Before a game, koreabaseball.com answers with only the records (and `code`
 * 200), so the innings and totals are empty.
 */
export function parseKboScoreboard(json: KboScoreboardResponse): KboScoreboard {
	const innings: KboInning[] = []
	const lines = kboGridText(kboGrid(json.table2).rows)
	const [away = [], home = []] = lines
	const length = Math.max(away.length, home.length)
	for (let i = 0; i < length; i++) {
		const inning = { num: i + 1, away: numberOrNull(away[i]), home: numberOrNull(home[i]) }
		if (inning.away !== null || inning.home !== null) innings.push(inning)
	}

	const totals = kboGridText(kboGrid(json.table3).rows)
	const team = (cells: string[] = []): KboLineTeam => ({
		runs: numberOrNull(cells[0]),
		hits: numberOrNull(cells[1]),
		errors: numberOrNull(cells[2]),
		walks: numberOrNull(cells[3]),
	})

	const record = (wins?: number | null, losses?: number | null, ties?: number | null) =>
		typeof wins === 'number' && typeof losses === 'number'
			? { wins, losses, ties: ties ?? 0 }
			: null

	return {
		innings,
		teams: { away: team(totals[0]), home: team(totals[1]) },
		records: {
			away: record(json.A_W_CN, json.A_L_CN, json.A_D_CN),
			home: record(json.H_W_CN, json.H_L_CN, json.H_D_CN),
		},
		attendance: numberOrNull(json.CROWD_CN),
		startTime: time(json.START_TM),
		endTime: time(json.END_TM),
		duration: minutes(json.USE_TM),
		venueKo: json.S_NM?.trim() || null,
	}
}

/* -------------------------------------------------------------------------------------------- */
/* Box score (GetBoxScoreScroll)                                                                 */
/* -------------------------------------------------------------------------------------------- */

export interface KboBatterLine {
	player: KboPlayerRef
	/** Spot in the batting order, 1 to 9 */
	order: number
	/** Came in for the player before them in this spot */
	substitute: boolean
	/** KBO's position letters, in order, e.g. 타, 一 (pinch hitter, then first base) */
	positionsKo: string[]
	/** Each inning's results, e.g. [['좌안'], [], ['삼진', '4구']] */
	innings: string[][]
	atBats: number | null
	hits: number | null
	rbi: number | null
	runs: number | null
	/** Season average, e.g. ".285" */
	avg: string | null
}

export type KboPitcherDecision = 'W' | 'L' | 'S' | 'H'

export interface KboPitcherLine {
	player: KboPlayerRef
	starter: boolean
	decision: KboPitcherDecision | null
	/** Season record after the game */
	seasonWins: number | null
	seasonLosses: number | null
	seasonSaves: number | null
	/** As MLB writes it: 5.2 for 5⅔ */
	inningsPitched: string | null
	battersFaced: number | null
	pitches: number | null
	atBats: number | null
	hits: number | null
	homeRuns: number | null
	/** Walks and hit batters together, as KBO counts them */
	baseOnBalls: number | null
	strikeOuts: number | null
	runs: number | null
	earnedRuns: number | null
	/** Season ERA, e.g. "2.92" */
	era: string | null
}

export interface KboTeamBox {
	batters: KboBatterLine[]
	pitchers: KboPitcherLine[]
}

/** One of the notes under the box score, e.g. 홈런 (home runs): 양의지22호(1회2점 송명기) */
export interface KboNote {
	labelKo: string
	textKo: string
}

export interface KboBox {
	teams: Record<KboSide, KboTeamBox>
	notes: KboNote[]
	/** Innings with a column in the batters' results */
	innings: number
}

export interface KboBoxScoreResponse {
	code?: string
	tableEtc?: string | null
	arrHitter?: { table1?: string | null; table2?: string | null; table3?: string | null }[] | null
	arrPitcher?: { table?: string | null }[] | null
}

const ref = (nameKo: string): KboPlayerRef => ({ nameKo: nameKo.trim(), id: null })

/** "1 2/3" → "1.2", "2/3" → "0.2", "3" → "3.0" */
export function toInningsPitched(text: string) {
	const match = text.trim().match(/^(?:(\d+))?\s*(?:([12])\/3)?$/)
	if (!match || (!match[1] && !match[2])) return null
	return `${match[1] ?? 0}.${match[2] ?? 0}`
}

const DECISIONS: Record<string, KboPitcherDecision> = { 승: 'W', 패: 'L', 세: 'S', 홀드: 'H' }

/** A team's batters: order, position and name; results by inning; and the batting line */
function parseBatters(tables: NonNullable<KboBoxScoreResponse['arrHitter']>[number]) {
	const names = kboGridText(kboGrid(tables.table1).rows)
	const results = kboGridText(kboGrid(tables.table2).rows)
	const stats = kboGridText(kboGrid(tables.table3).rows)

	return names.flatMap(([order, positions, name], i): KboBatterLine[] => {
		if (!name || !/^\d+$/.test(order ?? '')) return []
		const line = stats[i] ?? []
		return [
			{
				player: ref(name),
				order: Number(order),
				substitute: i > 0 && names[i - 1]?.[0] === order,
				positionsKo: [...(positions ?? '').replace(/\s/g, '')],
				innings: (results[i] ?? []).map((cell) =>
					cell
						.split('/')
						.map((entry) => entry.trim())
						.filter(Boolean),
				),
				atBats: numberOrNull(line[0]),
				hits: numberOrNull(line[1]),
				rbi: numberOrNull(line[2]),
				runs: numberOrNull(line[3]),
				avg: line[4]?.replace(/^0(?=\.)/, '') || null,
			},
		]
	})
}

/** A team's pitchers, in order of appearance */
function parsePitchers(table: string | null | undefined) {
	return kboGridText(kboGrid(table).rows).flatMap((cells): KboPitcherLine[] => {
		const [name, entry, result, w, l, s, ip, bf, np, ab, h, hr, bb, k, r, er, era] = cells
		if (!name) return []
		return [
			{
				player: ref(name),
				starter: entry === '선발',
				decision: DECISIONS[result?.trim() ?? ''] ?? null,
				seasonWins: numberOrNull(w),
				seasonLosses: numberOrNull(l),
				seasonSaves: numberOrNull(s),
				inningsPitched: toInningsPitched(ip ?? ''),
				battersFaced: numberOrNull(bf),
				pitches: numberOrNull(np),
				atBats: numberOrNull(ab),
				hits: numberOrNull(h),
				homeRuns: numberOrNull(hr),
				baseOnBalls: numberOrNull(bb),
				strikeOuts: numberOrNull(k),
				runs: numberOrNull(r),
				earnedRuns: numberOrNull(er),
				era: era?.trim() || null,
			},
		]
	})
}

/** The box score, or `null` before koreabaseball.com has one (`code` other than 100) */
export function parseKboBoxScore(json: KboBoxScoreResponse): KboBox | null {
	if (json.code !== '100' || !json.arrHitter?.length) return null

	const [awayBatters, homeBatters] = json.arrHitter.map(parseBatters)
	const [awayPitchers, homePitchers] = (json.arrPitcher ?? []).map(({ table }) =>
		parsePitchers(table),
	)

	const notes = kboGridText(kboGrid(json.tableEtc).rows).flatMap(([labelKo, textKo]) =>
		labelKo && textKo?.trim() ? [{ labelKo, textKo: textKo.replace(/\s+/g, ' ').trim() }] : [],
	)

	const innings = Math.max(
		0,
		...[awayBatters, homeBatters].flatMap((lines) =>
			(lines ?? []).map((line) => line.innings.length),
		),
	)

	return {
		teams: {
			away: { batters: awayBatters ?? [], pitchers: awayPitchers ?? [] },
			home: { batters: homeBatters ?? [], pitchers: homePitchers ?? [] },
		},
		notes,
		innings,
	}
}

/** Names in a note, e.g. 심판 (umpires): "김정국 김선수 김성철 이용혁" */
export const noteNames = (box: KboBox | null, labelKo: string) =>
	box?.notes
		.find((note) => note.labelKo === labelKo)
		?.textKo.split(/\s+/)
		.filter(Boolean) ?? []

export interface KboHomeRun {
	side: KboSide
	batter: KboPlayerRef
	/** The batter's home runs this season, this one included */
	number: number
	inning: number
	/** Runs it drove in, 1 to 4 */
	runs: number
	pitcher: KboPlayerRef | null
}

/**
 * The 홈런 note's home runs, e.g. "양의지22호(1회2점 송명기)": batter, season total, inning, runs
 * and pitcher. Each is credited to the side whose box score has the batter.
 */
export function parseKboHomeRuns(box: KboBox | null): KboHomeRun[] {
	const text = box?.notes.find((note) => note.labelKo === '홈런')?.textKo ?? ''
	return [...text.matchAll(/(\S+?)(\d+)호\((\d+)회(\d)점\s*([^)]*)\)/g)].map(
		([, name, number, inning, runs, pitcher]): KboHomeRun => ({
			side: box?.teams.home.batters.some((line) => line.player.nameKo === name) ? 'home' : 'away',
			batter: ref(name),
			number: Number(number),
			inning: Number(inning),
			runs: Number(runs),
			pitcher: pitcher.trim() ? ref(pitcher) : null,
		}),
	)
}

/* -------------------------------------------------------------------------------------------- */
/* Plays, from the batters' results by inning                                                    */
/* -------------------------------------------------------------------------------------------- */

export interface KboPlay {
	batter: KboPlayerRef
	/** As the box score writes it, e.g. 좌중안 (single to left-center) */
	resultKo: string
}

export interface KboHalfInning {
	inning: number
	half: 'top' | 'bottom'
	plays: KboPlay[]
}

/**
 * A side's plate appearances by inning, in the order they came: each inning picks up the batting
 * order after the last batter of the inning before, and goes around it as many times as the
 * results show. In a spot, a starter bats before the player who came in for them.
 */
function sidePlays(batters: KboBatterLine[], half: 'top' | 'bottom'): KboHalfInning[] {
	const innings = Math.max(0, ...batters.map((line) => line.innings.length))
	const halves: KboHalfInning[] = []
	let leadoff = 1

	for (let i = 0; i < innings; i++) {
		/** Each spot's plate appearances this inning, in order */
		const spots = new Map<number, KboPlay[]>()
		for (const line of batters) {
			for (const resultKo of line.innings[i] ?? []) {
				spots.set(line.order, [...(spots.get(line.order) ?? []), { batter: line.player, resultKo }])
			}
		}
		if (!spots.size) continue

		const plays: KboPlay[] = []
		let last = leadoff
		for (let round = 0; ; round++) {
			let any = false
			for (let k = 0; k < 9; k++) {
				const spot = ((leadoff - 1 + k) % 9) + 1
				const play = spots.get(spot)?.[round]
				if (!play) continue
				plays.push(play)
				last = spot
				any = true
			}
			if (!any) break
		}

		halves.push({ inning: i + 1, half, plays })
		leadoff = (last % 9) + 1
	}

	return halves
}

/** Both sides' plays, by half-inning in the order they were played */
export function kboPlays(box: KboBox | null): KboHalfInning[] | null {
	if (!box) return null
	const top = sidePlays(box.teams.away.batters, 'top')
	const bottom = sidePlays(box.teams.home.batters, 'bottom')
	return [...top, ...bottom].sort((a, b) =>
		a.inning === b.inning ? (a.half === 'top' ? -1 : 1) : a.inning - b.inning,
	)
}

/* -------------------------------------------------------------------------------------------- */
/* The whole game                                                                                */
/* -------------------------------------------------------------------------------------------- */

export interface KboGameTeam extends KboLineTeam {
	id: number
	code: string
	/** e.g. 두산 */
	nameKo: string
	/** e.g. 두산 베어스 */
	fullNameKo: string
	name: string
	teamName: string
	abbreviation: string
	record: KboRecord | null
}

export interface KboDecision {
	player: KboPlayerRef
	/** The pitcher's season record after the game, e.g. 2-1, or 4 SV */
	record: string | null
}

/** Everything the game page shows */
export interface KboGame extends Omit<
	KboGameSummary,
	'runs' | 'starters' | 'decisions' | 'venueKo' | 'startTime'
> {
	season: number
	venueKo: string | null
	startTime: string | null
	endTime: string | null
	duration: number | null
	attendance: number | null
	teams: Record<KboSide, KboGameTeam>
	innings: KboInning[]
	starters: Record<KboSide, KboPlayerRef | null>
	decisions: Record<'win' | 'loss' | 'save', KboDecision | null>
	box: KboBox | null
	plays: KboHalfInning[] | null
	homeRuns: KboHomeRun[]
	umpires: string[]
	/** Photos by player ID, from the teams' registers */
	photos: Record<string, string>
	/** The game on koreabaseball.com */
	url: string
}

/* -------------------------------------------------------------------------------------------- */
/* English                                                                                       */
/* -------------------------------------------------------------------------------------------- */

const POSITIONS: Record<string, string> = {
	투: 'P',
	포: 'C',
	一: '1B',
	二: '2B',
	三: '3B',
	유: 'SS',
	좌: 'LF',
	중: 'CF',
	우: 'RF',
	지: 'DH',
	타: 'PH',
	주: 'PR',
}

/** 타, 一 → PH-1B */
export function translatePositions(positionsKo: string[]) {
	return positionsKo.map((p) => POSITIONS[p] ?? p).join('-')
}

const VENUES: Record<string, string> = {
	잠실: 'Jamsil Baseball Stadium',
	고척: 'Gocheok Sky Dome',
	문학: 'Incheon SSG Landers Field',
	수원: 'Suwon KT Wiz Park',
	대전: 'Daejeon Hanwha Life Ballpark',
	광주: 'Gwangju-Kia Champions Field',
	대구: 'Daegu Samsung Lions Park',
	사직: 'Sajik Baseball Stadium',
	창원: 'Changwon NC Park',
	울산: 'Ulsan Munsu Baseball Stadium',
	포항: 'Pohang Baseball Stadium',
	청주: 'Cheongju Baseball Stadium',
}

export const translateVenue = (venueKo: string) => VENUES[venueKo] ?? venueKo

const COMPETITIONS: Record<KboCompetition, string> = {
	regular: 'Regular Season',
	'wild-card': 'Wild Card',
	'semi-playoff': 'Semi-Playoff',
	playoff: 'Playoff',
	'korean-series': 'Korean Series',
	'all-star': 'All-Star Game',
}

export const translateCompetition = (competition: KboCompetition) => COMPETITIONS[competition]

const CANCEL_REASONS: [RegExp, string][] = [
	[/우천/, 'Rain'],
	[/그라운드/, 'Wet Grounds'],
	[/미세먼지/, 'Fine Dust'],
	[/폭염/, 'Heat'],
	[/강풍/, 'Wind'],
	[/한파/, 'Cold'],
]

/** 우천취소 → Rain, as the Stats API names a postponement's reason; `undefined` for others */
export const translateCancelReason = (reasonKo: string) =>
	CANCEL_REASONS.find(([pattern]) => pattern.test(reasonKo))?.[1]

const NOTE_LABELS: Record<string, string> = {
	결승타: 'Game-winning RBI',
	홈런: 'Home runs',
	'3루타': 'Triples',
	'2루타': 'Doubles',
	실책: 'Errors',
	도루: 'Stolen bases',
	도루자: 'Caught stealing',
	주루사: 'Out on the bases',
	견제사: 'Picked off',
	병살타: 'Grounded into DP',
	폭투: 'Wild pitches',
	포일: 'Passed balls',
	보크: 'Balks',
	심판: 'Umpires',
}

export const translateNoteLabel = (labelKo: string) => NOTE_LABELS[labelKo] ?? labelKo

/**
 * A note's text in English where it's KBO's shorthand: innings (2회 → 2nd), a home run's season
 * total, runs and pitcher (양의지22호(1회2점 송명기) → 양의지 (22): 1st, 2-run off 송명기), and the
 * game-winning hit's situation. Names stay in Korean.
 */
export function translateNote(textKo: string) {
	return textKo
		.replace(
			/(\S+?)(\d+)호\((\d+)회(\d)점\s*([^)]*)\)/g,
			(_, name, number, inning, runs, pitcher) => {
				const kind = runs === '1' ? 'solo' : runs === '4' ? 'grand slam' : `${runs}-run`
				const off = pitcher.trim() ? ` off ${pitcher.trim()}` : ''
				return `${name} (${number}): ${ordinalNumber(Number(inning))}, ${kind}${off}`
			},
		)
		.replace(/(\d+)회\s*(\d)사\s*([123,]+루|만루)?서\s*/g, (_, inning, outs, bases) => {
			const on = bases === '만루' ? 'bases loaded' : bases ? `${bases.replace('루', '')} on` : ''
			return `${ordinalNumber(Number(inning))}, ${outs} out${on ? `, ${on}` : ''}: `
		})
		.replace(/(\S+?)(\d*)\(((?:\d+\s*)+)회\)/g, (_, name, times, innings: string) => {
			const list = innings
				.trim()
				.split(/\s+/)
				.map((n) => ordinalNumber(Number(n)))
				.join(', ')
			return `${name}${times ? ` ×${times}` : ''} (${list})`
		})
		.replace(
			/(좌|중|우)전 안타/g,
			(_, side) => `single to ${{ 좌: 'left', 중: 'center', 우: 'right' }[side as '좌']}`,
		)
		.replace(
			/(좌|중|우)월 홈런/g,
			(_, side) => `home run to ${{ 좌: 'left', 중: 'center', 우: 'right' }[side as '좌']}`,
		)
		.replace(
			/(좌|중|우)(?:익수|중간)? 2루타/g,
			(_, side) => `double to ${{ 좌: 'left', 중: 'center', 우: 'right' }[side as '좌']}`,
		)
}

function ordinalNumber(n: number) {
	const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'
	return `${n}${suffix}`
}

/** Fielders in a scorebook result, by KBO's letter or digit */
const FIELDERS: Record<string, { name: string; number: number }> = {
	투: { name: 'pitcher', number: 1 },
	포: { name: 'catcher', number: 2 },
	'1': { name: 'first', number: 3 },
	'2': { name: 'second', number: 4 },
	'3': { name: 'third', number: 5 },
	유: { name: 'shortstop', number: 6 },
	좌: { name: 'left', number: 7 },
	중: { name: 'center', number: 8 },
	우: { name: 'right', number: 9 },
}

type Outcome = { en: string; notation: (n: string) => Notation }

/** What a result's fielders did, e.g. 땅 (ground out); longest first */
const OUTCOMES: [string, Outcome][] = [
	['희비', { en: 'Sacrifice fly', notation: () => ({ label: 'SF', kind: 'out' }) }],
	['희번', { en: 'Sacrifice bunt', notation: () => ({ label: 'SAC', kind: 'out' }) }],
	[
		'희실',
		{
			en: 'Sacrifice bunt, reaches on an error',
			notation: (n) => ({ label: `E${n}`, kind: 'error', bases: 1 }),
		},
	],
	[
		'희야',
		{
			en: "Sacrifice bunt, fielder's choice",
			notation: () => ({ label: 'FC', kind: 'fieldersChoice', bases: 1 }),
		},
	],
	['안', { en: 'Single', notation: () => ({ label: '1B', kind: 'hit', bases: 1 }) }],
	['2', { en: 'Double', notation: () => ({ label: '2B', kind: 'hit', bases: 2 }) }],
	['3', { en: 'Triple', notation: () => ({ label: '3B', kind: 'hit', bases: 3 }) }],
	['홈', { en: 'Home run', notation: () => ({ label: 'HR', kind: 'homeRun', bases: 4 }) }],
	['땅', { en: 'Groundout', notation: (n) => ({ label: `G${n}`, kind: 'out' }) }],
	['비', { en: 'Flyout', notation: (n) => ({ label: `F${n}`, kind: 'out' }) }],
	['직', { en: 'Lineout', notation: (n) => ({ label: `L${n}`, kind: 'out' }) }],
	['파', { en: 'Foul popout', notation: (n) => ({ label: `F${n}`, kind: 'out' }) }],
	[
		'병',
		{
			en: 'Grounds into a double play',
			notation: (n) => ({ label: `G${n}`, kind: 'out', badge: 'DP' }),
		},
	],
	[
		'삼중',
		{
			en: 'Triple play',
			notation: (n) => ({ label: `G${n}`, kind: 'out', badge: 'TP' }),
		},
	],
	[
		'실',
		{
			en: 'Reaches on an error',
			notation: (n) => ({ label: `E${n}`, kind: 'error', bases: 1 }),
		},
	],
	[
		'야',
		{
			en: "Fielder's choice",
			notation: () => ({ label: 'FC', kind: 'fieldersChoice', bases: 1 }),
		},
	],
	['번', { en: 'Bunt', notation: (n) => ({ label: `B${n}`, kind: 'out' }) }],
]

/** Results with no fielder */
const WHOLE: Record<string, { en: string; notation: Notation }> = {
	삼진: { en: 'Strikeout', notation: { label: 'K', kind: 'strikeout' } },
	스낫: {
		en: 'Strikeout, reaches on a dropped third strike',
		notation: { label: 'K', kind: 'strikeout', bases: 1 },
	},
	낫아웃: {
		en: 'Strikeout, reaches on a dropped third strike',
		notation: { label: 'K', kind: 'strikeout', bases: 1 },
	},
	'4구': { en: 'Walk', notation: { label: 'BB', kind: 'walk', bases: 1 } },
	고4: { en: 'Intentional walk', notation: { label: 'IBB', kind: 'walk', bases: 1 } },
	사구: { en: 'Hit by pitch', notation: { label: 'HBP', kind: 'walk', bases: 1 } },
	타방: { en: "Catcher's interference", notation: { label: 'CI', kind: 'other', bases: 1 } },
}

/** A result split into its fielders (one, or two for a ball between them) and what they did */
function splitResult(resultKo: string) {
	const text = resultKo.replace(/\s/g, '')
	for (const length of [2, 1, 0]) {
		const fielders = [...text.slice(0, length)]
		if (fielders.some((c) => !FIELDERS[c])) continue
		const outcome = OUTCOMES.find(([ko]) => ko === text.slice(length))?.[1]
		if (outcome) return { fielders: fielders.map((c) => FIELDERS[c]), outcome }
	}
	return null
}

/** Where a ball went: "left", "left-center", "short and left" */
function where(fielders: { name: string }[]) {
	const names = fielders.map((f) => f.name)
	if (names.length < 2) return names[0]
	const [a, b] = names
	if ((a === 'left' || a === 'right') && b === 'center') return `${a}-center`
	return `${a === 'shortstop' ? 'short' : a} and ${b}`
}

/**
 * A box score result in English, e.g. 좌중안 → "Single to left-center", 유땅 → "Groundout to
 * shortstop", 4구 → "Walk". Anything not recognized is returned as is.
 */
export function translateResult(resultKo: string) {
	const text = resultKo.replace(/\s/g, '')
	if (WHOLE[text]) return WHOLE[text].en

	const split = splitResult(text)
	if (!split) return resultKo
	const place = where(split.fielders)
	// A fly ball an infielder catches is a popout
	const infield = split.fielders.length && split.fielders.every((f) => f.number <= 6)
	const outcome = split.outcome.en === 'Flyout' && infield ? 'Popout' : split.outcome.en
	if (!place) return outcome
	const preposition = /error/.test(outcome) ? ' by ' : ' to '
	return `${outcome}${preposition}${place}`
}

/**
 * A box score result in scorer's notation, e.g. 좌안 → 1B, 유땅 → G6, 2병 → G4 (DP), 삼진 → K.
 * Unrecognized results keep their Korean label.
 */
export function kboNotation(resultKo: string): Notation {
	const text = resultKo.replace(/\s/g, '')
	if (WHOLE[text]) return WHOLE[text].notation

	const split = splitResult(text)
	if (!split) return { label: resultKo, kind: 'other' }
	return split.outcome.notation(split.fielders.map((f) => f.number).join('-'))
}

/** A scorecard box: the result's notation, and the out it made, 1 to 3 */
export type KboScorecardCell = Notation & {
	resultKo: string
	out?: number
	/** The batter came around to score; only known for a home run */
	scored: boolean
}

/** Outs a result made: 2 for a double play, 3 for a triple play */
function outsMade(notation: Notation) {
	if (notation.kind !== 'out' && !(notation.kind === 'strikeout' && !notation.bases)) return 0
	return notation.badge === 'DP' ? 2 : notation.badge === 'TP' ? 3 : 1
}

/**
 * A side's scorecard: each batting line's results by inning in scorer's notation, with the out
 * each made, counted through the half-inning in the order of `kboPlays`. Runners thrown out on
 * the bases aren't in the box score, so the outs are the batters' alone.
 */
export function kboScorecard(box: KboBox, side: KboSide): KboScorecardCell[][][] {
	const batters = box.teams[side].batters
	const halves = kboPlays(box)?.filter((h) => h.half === (side === 'away' ? 'top' : 'bottom'))

	/** Outs before each play, by inning, batter and their plate appearance that inning */
	const outsBefore = new Map<string, number>()
	for (const half of halves ?? []) {
		let outs = 0
		const seen = new Map<KboPlayerRef, number>()
		for (const play of half.plays) {
			const n = seen.get(play.batter) ?? 0
			seen.set(play.batter, n + 1)
			outsBefore.set(
				`${half.inning}-${batters.findIndex((b) => b.player === play.batter)}-${n}`,
				outs,
			)
			outs += outsMade(kboNotation(play.resultKo))
		}
	}

	return batters.map((line, b) =>
		line.innings.map((results, i) =>
			results.map((resultKo, n): KboScorecardCell => {
				const notation = kboNotation(resultKo)
				const made = outsMade(notation)
				const before = outsBefore.get(`${i + 1}-${b}-${n}`)
				return {
					...notation,
					resultKo,
					out: made && before !== undefined ? Math.min(3, before + made) : undefined,
					scored: notation.kind === 'homeRun',
				}
			}),
		),
	)
}

/** A pitcher's season record in a decision, e.g. W 2-1, or 4 SV */
export function decisionRecord(
	line: KboPitcherLine | undefined,
	decision: 'win' | 'loss' | 'save',
) {
	if (!line) return null
	if (decision === 'save') return line.seasonSaves !== null ? `${line.seasonSaves} SV` : null
	return line.seasonWins !== null && line.seasonLosses !== null
		? `${line.seasonWins}-${line.seasonLosses}`
		: null
}
