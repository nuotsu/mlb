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
					'team,currentTeam,preferredTeam,rosterEntries,draft,relatives,awards(team)',
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
