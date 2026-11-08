/**
 * KBO games in the Stats API's shapes, just enough of them for the components the MLB pages
 * already use: the game card, linescore, team scores, status and base runners.
 */

import {
	kboGamePath,
	translateCancelReason,
	translateCompetition,
	type KboCompetition,
	type KboGame,
	type KboGameSummary,
	type KboInning,
	type KboLineTeam,
	type KboSide,
} from '#lib/kbo-game.js'
import { currentKboScheduleGame, type KboScheduleGame } from '#lib/kbo-schedule.js'
import { kboTeamById } from '#lib/kbo.js'
import type { LinkedMlbGame } from '#lib/npb-game-mlb.js'

/** KBO plays nine innings, and up to eleven before a tie */
const SCHEDULED_INNINGS = 9

/** A KBO team (or All-Star side), with its English name, as the Stats API would give it */
export function toMlbTeam(teamId: number, nameKo = ''): MLB.Team {
	const info = kboTeamById(teamId)
	return {
		id: teamId,
		name: info?.name ?? nameKo,
		clubName: info?.teamName ?? nameKo,
		teamName: info?.teamName ?? nameKo,
		abbreviation: info?.abbreviation ?? nameKo,
	} as MLB.Team
}

/** Korea time, as an ISO timestamp; 18:30, KBO's usual weeknight start, when it isn't known */
export function kboGameDate(game: { date: string; startTime: string | null }) {
	return `${game.date}T${game.startTime ?? '18:30'}:00+09:00`
}

/**
 * A stand-in `gamePk` for a KBO game, unique within a season and negative so it can't collide
 * with the Stats API's, nor (offset past them) with NPB's stand-ins: components key and number
 * their games by it.
 */
export function kboGamePk(id: string) {
	const match = id.match(/^\d{4}(\d{4})([A-Z]{2})([A-Z]{2})(\d)$/)
	if (!match) return -1_000_000_000
	const codes = 'HT SS LG OB KT SK LT HH NC WO WE EA'.split(' ')
	const index = (code: string) => Math.max(0, codes.indexOf(code))
	const pair = index(match[2]) * codes.length + index(match[3])
	return -(1_000_000_000 + (Number(match[1]) * codes.length ** 2 + pair) * 10 + Number(match[4]))
}

/** The Stats API's game type nearest each: its Wild Card, Division Series, LCS and World Series */
const GAME_TYPES: Record<KboCompetition, string> = {
	regular: 'R',
	'wild-card': 'F',
	'semi-playoff': 'D',
	playoff: 'L',
	'korean-series': 'W',
	'all-star': 'A',
}

/** A postseason game's round and number, as the Stats API's `ALCS Game 3` */
function describe(competition: KboCompetition, number: number | null | undefined) {
	if (competition === 'regular') return undefined
	if (competition === 'all-star') return translateCompetition(competition)
	return `${translateCompetition(competition)} Game ${number ?? 1}`
}

/** The Stats API's status for a KBO game */
function status(game: {
	state: KboGameSummary['state']
	isCancelled: boolean
	cancelReasonKo: string | null
}) {
	return {
		abstractGameState: game.state,
		// Called-off games count for neither team, as the MLB calendar leaves out postponements
		detailedState: game.isCancelled
			? 'Postponed'
			: game.state === 'Final'
				? 'Final'
				: game.state === 'Live'
					? 'In Progress'
					: 'Scheduled',
		// Shown in place of the state, as the Stats API's reason is
		reason: game.isCancelled
			? (game.cancelReasonKo && translateCancelReason(game.cancelReasonKo)) || undefined
			: undefined,
	}
}

/**
 * A KBO schedule game in the Stats API's schedule shape, for the MLB game card and team
 * calendars, linking to our KBO game page. A tie has no winner.
 */
export function toMlbScheduleGame(scheduled: KboScheduleGame): LinkedMlbGame {
	const game = currentKboScheduleGame(scheduled)
	const { home, away } = game.teams
	const decided = game.state === 'Final' && !game.isCancelled
	const side = (team: typeof home, other: typeof home) => ({
		team: toMlbTeam(team.id, team.nameKo),
		leagueRecord: team.record ?? undefined,
		score: game.isCancelled ? undefined : (team.runs ?? undefined),
		isWinner:
			decided && team.runs !== null && other.runs !== null && team.runs !== other.runs
				? team.runs > other.runs
				: undefined,
	})

	return {
		gamePk: kboGamePk(game.id),
		gameType: GAME_TYPES[game.competition],
		description: describe(game.competition, game.summary?.gameNumber ?? game.series.number),
		gameDate: kboGameDate(game),
		officialDate: game.date,
		seriesGameNumber: game.series.number,
		gamesInSeries: game.series.total,
		status: status(game),
		teams: { away: side(away, home), home: side(home, away) },
		href: kboGamePath(game.id),
	} as unknown as LinkedMlbGame
}

/** Innings, totals and, while live, the inning, count and runners, as the Stats API's linescore */
export function toMlbLinescore(game: {
	innings: KboInning[]
	teams: Record<KboSide, Partial<KboLineTeam>>
	summary?: Pick<KboGameSummary, 'currentInning' | 'count' | 'runners' | 'state'> | null
}): MLB.Linescore {
	const played = game.innings.filter((inning) => inning.away !== null)
	const live = game.summary?.state === 'Live' ? game.summary : null
	const runs = (value: number | null) => (value === null ? {} : { runs: value })
	// koreabaseball.com says which bases are taken, not by whom
	const runner = (base: number) =>
		live?.runners.includes(base) ? { id: 0, fullName: 'Runner' } : undefined

	return {
		currentInning: live?.currentInning?.num ?? played.at(-1)?.num,
		inningState: live?.currentInning
			? live.currentInning.half === 'top'
				? 'Top'
				: 'Bottom'
			: undefined,
		scheduledInnings: SCHEDULED_INNINGS,
		innings: played.map((inning) => ({
			num: inning.num,
			away: runs(inning.away),
			home: runs(inning.home),
		})),
		teams: Object.fromEntries(
			(['away', 'home'] as const).map((key) => [
				key,
				{
					runs: game.teams[key].runs ?? undefined,
					hits: game.teams[key].hits ?? undefined,
					errors: game.teams[key].errors ?? undefined,
				},
			]),
		),
		...(live?.count ?? {}),
		offense: { first: runner(1), second: runner(2), third: runner(3) },
	} as unknown as MLB.Linescore
}

/**
 * The schedule game's linescore for the MLB card, from its scoreboard and the day's game list;
 * empty (nine blank innings, as the Stats API has for a postponed game) until there is one
 */
export function toMlbScheduleLinescore(game: KboScheduleGame) {
	if (!game.linescore) {
		return {
			innings: [],
			teams: { away: {}, home: {} },
			scheduledInnings: SCHEDULED_INNINGS,
		} as unknown as MLB.Linescore
	}
	return toMlbLinescore({
		innings: game.linescore.innings,
		teams: game.linescore.teams,
		summary: game.summary,
	})
}

/**
 * Just enough of a live feed for the MLB card to show the game as it stands (inning, score, the
 * bases) without polling the Stats API, which has no KBO games.
 */
export function toMlbScheduleFeed(game: LinkedMlbGame, linescore: MLB.Linescore) {
	return {
		gamePk: game.gamePk,
		gameData: {
			status: game.status,
			teams: { away: game.teams.away.team, home: game.teams.home.team },
		},
		liveData: { linescore },
	} as unknown as MLB.LiveGameFeed
}

/** The game page's game, in the Stats API's shape */
export function toMlbGame(game: KboGame): LinkedMlbGame {
	const side = (key: KboSide) => ({
		team: toMlbTeam(game.teams[key].id, game.teams[key].nameKo),
		leagueRecord: game.teams[key].record ?? undefined,
		score: game.isCancelled ? undefined : (game.teams[key].runs ?? undefined),
	})

	return {
		gamePk: kboGamePk(game.id),
		gameType: GAME_TYPES[game.competition],
		description: describe(game.competition, game.gameNumber),
		gameDate: kboGameDate(game),
		officialDate: game.date,
		status: status(game),
		teams: { away: side('away'), home: side('home') },
		href: kboGamePath(game.id),
	} as unknown as LinkedMlbGame
}

/** The game page's linescore */
export const toMlbGameLinescore = (game: KboGame) =>
	toMlbLinescore({ innings: game.innings, teams: game.teams, summary: game })
