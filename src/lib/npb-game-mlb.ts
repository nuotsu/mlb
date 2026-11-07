/**
 * An NPB game in the Stats API's shapes, just enough of them for the game components the MLB
 * pages already use: the linescore, the team scores and the status.
 */

import type { NpbGame, NpbGameTeam, NpbLang } from '#lib/npb-game.js'

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
