import { error } from '@sveltejs/kit'
import { fetchMLB, notFoundOnMlb404 } from '#lib/fetch/index.js'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' })

	const personId = params.personId

	const [person, baseballStats] = await Promise.all([
		fetchMLB<MLB.PersonResponse>(
			`/api/v1/people/${personId}`,
			{
				hydrate: [
					'team,currentTeam,preferredTeam,rosterEntries,draft,relatives,education,awards(team)',
					'stats(group=[pitching,hitting],type=[yearByYear,career])',
				],
			},
			{ fetch },
		),
		fetchMLB<MLB.BaseballStat[]>('/api/v1/baseballStats', undefined, { fetch }),
	]).catch((e) => notFoundOnMlb404(e, 'Player not found'))

	const player = person.people?.[0]
	if (!player) error(404, 'Player not found')

	return {
		person: player,
		baseballStats,
		/** Streamed, so the page renders without waiting on it. */
		debutGamePk: player.mlbDebutDate
			? fetchDebutGamePk(personId, player.mlbDebutDate, fetch)
			: Promise.resolve(undefined),
		/** Streamed: seasons spent as an MLB manager, which stats and roster entries don't cover. */
		managerSeasons: fetchManagerSeasons(player.id, fetch),
	}
}

/** How many past seasons to scan for a manager's tenure. */
const MANAGER_LOOKBACK = 30

type CoachesResponse = { roster?: { person: { id: number }; jobId: string }[] }

/**
 * Seasons the person managed an MLB club. Managers have no stats and their roster
 * entries are from playing days, so the history is rebuilt from each team's coaching
 * staff: find the current club among the 30, then walk that club back year by year.
 * Only that club is scanned, so tenures with earlier clubs are not included.
 */
async function fetchManagerSeasons(personId: number, fetch: typeof globalThis.fetch) {
	const none: { season: number; team: MLB.Team }[] = []

	try {
		const thisYear = new Date().getFullYear()

		const { roster: managers } = await fetchMLB<{ roster?: { person: { id: number } }[] }>(
			'/api/v1/jobs',
			{ jobType: 'MNGR', sportId: '1' },
			{ fetch },
		)
		if (!managers?.some(({ person }) => person.id === personId)) return none

		const { teams } = await fetchMLB<{ teams: MLB.Team[] }>(
			'/api/v1/teams',
			{ sportId: '1', fields: 'teams,id,name' },
			{ fetch },
		)

		const isManager = async (teamId: number, season: number) => {
			const { roster } = await fetchMLB<CoachesResponse>(
				`/api/v1/teams/${teamId}/coaches`,
				{ season: String(season) },
				{ fetch },
			)
			return !!roster?.some(({ person, jobId }) => jobId === 'MNGR' && person.id === personId)
		}

		const flags = await Promise.all(teams.map((t) => isManager(t.id, thisYear).catch(() => false)))
		const team = teams.find((_, i) => flags[i])
		if (!team) return none

		const years = Array.from({ length: MANAGER_LOOKBACK + 1 }, (_, i) => thisYear - i)
		const hits = await Promise.all(years.map((s) => isManager(team.id, s).catch(() => false)))

		return years.flatMap((season, i) => (hits[i] ? [{ season, team }] : []))
	} catch {
		return none
	}
}

/** The player's first game on their debut date (the opener, if it was a doubleheader). */
async function fetchDebutGamePk(personId: string, date: string, fetch: typeof globalThis.fetch) {
	try {
		const { stats } = await fetchMLB<{
			stats?: { splits?: { game?: { gamePk?: number; gameNumber?: number } }[] }[]
		}>(
			`/api/v1/people/${personId}/stats`,
			{
				stats: 'gameLog',
				group: ['hitting', 'pitching'],
				startDate: date,
				endDate: date,
				fields: 'stats,splits,game,gamePk,gameNumber',
			},
			{ fetch },
		)

		return stats
			?.flatMap(({ splits }) => splits ?? [])
			.map(({ game }) => game)
			.filter((game) => game?.gamePk)
			.sort((a, b) => (a?.gameNumber ?? 1) - (b?.gameNumber ?? 1))[0]?.gamePk
	} catch {
		// Falls back to the schedule for that day
		return undefined
	}
}
