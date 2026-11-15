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
		/** Streamed: seasons on an MLB coaching staff, which stats and roster entries don't cover. */
		staffSeasons: player.active ? Promise.resolve([]) : fetchStaffSeasons(player.id, fetch),
	}
}

/** How many past seasons to scan for a coaching tenure. */
const STAFF_LOOKBACK = 30

type CoachesResponse = { roster?: { person: { id: number } }[] }

/**
 * Seasons the person was on an MLB club's coaching staff in any role (manager,
 * coach, coordinator...). Staff have no stats and their roster entries are from
 * playing days, so the history is rebuilt from each team's coaching
 * staff: find the current club among the 30, walk it back while the run continues,
 * then look for the previous club in the season before the run, and repeat.
 * A season off between clubs ends the search.
 */
async function fetchStaffSeasons(personId: number, fetch: typeof globalThis.fetch) {
	const none: { season: number; team: MLB.Team }[] = []

	try {
		const thisYear = new Date().getFullYear()

		const { teams } = await fetchMLB<{ teams: MLB.Team[] }>(
			'/api/v1/teams',
			{ sportId: '1', fields: 'teams,id,name' },
			{ fetch },
		)

		const onStaff = async (teamId: number, season: number) => {
			const { roster } = await fetchMLB<CoachesResponse>(
				`/api/v1/teams/${teamId}/coaches`,
				{ season: String(season) },
				{ fetch },
			)
			return !!roster?.some(({ person }) => person.id === personId)
		}

		const findClub = async (season: number) => {
			const flags = await Promise.all(
				teams.map((t) => onStaff(t.id, season).catch(() => false)),
			)
			return teams.find((_, i) => flags[i])
		}

		const floor = thisYear - STAFF_LOOKBACK
		const seasons: { season: number; team: MLB.Team }[] = []

		// Walk back through consecutive seasons with one club, then search all clubs
		// for the season just before the run to pick up the previous one
		// Staff not yet announced for this season may still have been on last year's
		let start = thisYear
		for (let year = thisYear; year >= floor; ) {
			let team = await findClub(year)
			if (!team && year === start && start === thisYear) {
				start = year -= 1
				team = await findClub(year)
			}
			if (!team) break

			const years = Array.from({ length: year - floor + 1 }, (_, i) => year - i)
			const hits = await Promise.all(years.map((s) => onStaff(team.id, s).catch(() => false)))
			const run = hits.indexOf(false) === -1 ? hits.length : hits.indexOf(false)

			for (const season of years.slice(0, run)) seasons.push({ season, team })
			year -= run
		}

		return seasons
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
