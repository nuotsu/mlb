/**
 * An NPB game in the Stats API's shapes, just enough of them for the game components the MLB
 * pages already use: the linescore, the team scores and the status.
 */

import type { NpbGame, NpbGameRef, NpbGameTeam, NpbLang } from '#lib/npb-game.js'
import { npbGamePath, translateStatus } from '#lib/npb-game.js'
import { NPB_TEAM_INFO } from '#lib/npb-roster.js'
import type { NpbScheduleGame, NpbScheduleTeam } from '#lib/npb-schedule.js'
import { NPB_TEAMS } from '#lib/npb.js'

/** NPB plays nine innings, and up to twelve before a tie */
const SCHEDULED_INNINGS = 9

export function toMlbTeam(team: NpbGameTeam, lang: NpbLang = 'en'): MLB.Team {
	const ja = lang === 'ja'
	const name = ja ? team.nameJa : (team.name ?? team.nameJa)
	const short = ja ? team.shortNameJa : (team.teamName ?? team.shortNameJa)

	return {
		id: team.id ?? 0,
		name,
		clubName: short,
		teamName: short,
		abbreviation: ja ? team.shortNameJa : (team.abbreviation ?? team.shortNameJa),
	} as MLB.Team
}

/** Japan time, as an ISO timestamp; noon when the start time isn't known yet */
export function npbGameDate(game: Pick<NpbGame, 'date' | 'startTime'>) {
	return `${game.date}T${game.startTime ?? '12:00'}:00+09:00`
}

export function toMlbGame(game: NpbGame, lang: NpbLang = 'en'): MLB.Game {
	const side = (key: 'away' | 'home') => ({
		team: toMlbTeam(game.teams[key], lang),
		score: game.teams[key].runs ?? undefined,
	})

	return {
		gamePk: 0,
		gameDate: npbGameDate(game),
		status: {
			abstractGameState: game.state,
			detailedState: game.isCancelled ? 'Postponed' : game.state,
			reason: undefined,
		},
		teams: { away: side('away'), home: side('home') },
	} as unknown as MLB.Game
}

export function toMlbLinescore(game: NpbGame): MLB.Linescore {
	const played = game.innings.filter((inning) => inning.away !== null)
	const last = played.at(-1)
	const runs = (value: number | 'X' | null) => (typeof value === 'number' ? { runs: value } : {})

	return {
		currentInning: game.currentInning?.num ?? last?.num,
		inningState: game.currentInning
			? game.currentInning.half === 'top'
				? 'Top'
				: 'Bottom'
			: undefined,
		scheduledInnings: Math.max(SCHEDULED_INNINGS, played.length),
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
	} as unknown as MLB.Linescore
}

/** An MLB-shaped game that links somewhere other than `/game/{gamePk}`, like an NPB game's page */
export type LinkedMlbGame = MLB.Game & { href?: string }

/** The game's page: its own `href`, else the MLB game page */
export const gameHref = (game: LinkedMlbGame) => game.href ?? `/game/${game.gamePk}`

const NPB_TEAM_ORDER = Object.keys(NPB_TEAM_INFO).map(Number)

/**
 * A stand-in `gamePk` for an NPB game, unique within a season and negative so it can't collide
 * with the Stats API's: components key and number their games by it.
 */
export function npbGamePk({ date, code }: NpbGameRef) {
	const [home, away, number] = code.split('-')
	const index = (teamCode: string) =>
		NPB_TEAM_ORDER.findIndex((id) => NPB_TEAM_INFO[id].code === teamCode)
	const pair = index(home) * NPB_TEAM_ORDER.length + index(away)
	return -((Number(date) * NPB_TEAM_ORDER.length ** 2 + pair) * 100 + Number(number))
}

/** A schedule's team, with its official English name, as the Stats API would give it */
export function toMlbScheduleTeam(team: NpbScheduleTeam, lang: NpbLang = 'en'): MLB.Team {
	const { franchiseName, clubName } = NPB_TEAM_INFO[team.id]
	const abbreviation = Object.values(NPB_TEAMS).find(({ id }) => id === team.id)?.abbreviation

	return toMlbTeam(
		{
			id: team.id,
			code: team.code,
			nameJa: team.shortNameJa,
			shortNameJa: team.shortNameJa,
			name: `${franchiseName} ${clubName}`,
			teamName: clubName,
			abbreviation: abbreviation ?? null,
			runs: team.runs,
			hits: null,
			errors: null,
		},
		lang,
	)
}

/**
 * An NPB schedule game in the Stats API's schedule shape, for the schedule and team calendar
 * components, linking to our NPB game page. A tie has no winner.
 */
export function toMlbScheduleGame(game: NpbScheduleGame, lang: NpbLang = 'en'): LinkedMlbGame {
	const { home, away } = game.teams
	const decided = game.state === 'Final' && !game.isCancelled && !game.isTie
	const side = (team: NpbScheduleTeam, other: NpbScheduleTeam) => ({
		team: toMlbScheduleTeam(team, lang),
		leagueRecord: team.record ?? undefined,
		score: game.isCancelled ? undefined : (team.runs ?? undefined),
		isWinner:
			decided && team.runs !== null && other.runs !== null ? team.runs > other.runs : undefined,
	})

	return {
		gamePk: npbGamePk(game.ref),
		gameType: 'R',
		gameDate: npbGameDate(game),
		officialDate: game.date,
		status: {
			abstractGameState: game.state,
			// Called-off games count for neither team, as the MLB calendar leaves out postponements
			detailedState: game.isCancelled
				? game.statusJa === '中止'
					? 'Postponed'
					: 'Cancelled'
				: game.statusJa
					? translateStatus(game.statusJa)
					: game.state === 'Preview'
						? 'Scheduled'
						: game.state,
			// e.g. No game, shown in place of the state
			reason:
				game.isCancelled && game.statusJa !== '中止'
					? translateStatus(game.statusJa ?? '')
					: undefined,
		},
		teams: { away: side(away, home), home: side(home, away) },
		href: npbGamePath(game.ref),
	} as unknown as LinkedMlbGame
}
