import { error } from '@sveltejs/kit'
import { fetchMLB, notFoundOnMlb404 } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' })

	const personId = params.personId

	const [person, baseballStats] = await Promise.all([
		fetchMLB<MLB.PersonResponse>(
			`/api/v1/people/${personId}`,
			{
				hydrate: [
					'team,currentTeam,preferredTeam,rosterEntries,draft,relatives',
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
	}
}
