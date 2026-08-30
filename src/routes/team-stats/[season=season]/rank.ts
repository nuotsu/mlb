import { LOWER_IS_BETTER } from '$lib/stats'

export type StatGroup = 'hitting' | 'pitching'

/** Popular team hitting stats, in the order they're shown */
export const HITTING_STATS = [
	'runs',
	'homeRuns',
	'rbi',
	'hits',
	'doubles',
	'triples',
	'stolenBases',
	'avg',
	'obp',
	'slg',
	'ops',
]

/** Popular team pitching stats — `runs` and `homeRuns` are the ones allowed */
export const PITCHING_STATS = [
	'era',
	'wins',
	'losses',
	'saves',
	'strikeOuts',
	'whip',
	'inningsPitched',
	'runs',
	'homeRuns',
]

type Rankable = {
	team: MLB.TeamDetailed
	stat: Record<string, number | string>
}

/**
 * `inningsPitched` reads as innings.outs — "145.2" is 145⅔ innings — so its
 * fraction counts in thirds, not tenths. Everything else is a plain number, and
 * anything missing (a team that played no games that month) sorts last.
 */
function value(name: string, stat: Rankable['stat']) {
	const n = Number(stat?.[name])
	if (!Number.isFinite(n)) return null
	if (name !== 'inningsPitched') return n
	return Math.trunc(n) + Math.round((n % 1) * 10) / 3
}

/**
 * Sorts teams best-first by `sortStat` — highest wins, except for the stats
 * where the lower number is the better one (ERA, WHIP, runs allowed…) — and
 * stamps each row with its rank overall and within its own league, the "15th in
 * the NL" number. Tied teams share a rank, so the team behind two teams tied for
 * 2nd is 4th.
 */
export function rankTeams<T extends Rankable>(rows: T[], sortStat: string, group: StatGroup) {
	const lowerIsBetter = LOWER_IS_BETTER[group]?.has(sortStat) ?? false

	const sorted = [...rows].sort((a, b) => {
		const [x, y] = [value(sortStat, a.stat), value(sortStat, b.stat)]
		if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
		return lowerIsBetter ? x - y : y - x
	})

	const leagues = new Map<number, { placed: number; rank: number; last?: number | null }>()
	let rank = 0
	let last: number | null | undefined

	return sorted.map((row, i) => {
		const current = value(sortStat, row.stat)

		if (last === undefined || current !== last) rank = i + 1
		last = current

		const leagueId = row.team.league?.id ?? 0
		const league = leagues.get(leagueId) ?? { placed: 0, rank: 0 }
		league.placed++
		if (league.last === undefined || current !== league.last) league.rank = league.placed
		league.last = current
		leagues.set(leagueId, league)

		return { ...row, rank, leagueRank: league.rank }
	})
}
