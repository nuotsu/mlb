import { fetchMLB } from '$lib/fetch'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' })

	const teams = await fetchMLB<MLB.TeamsResponse>(
		`/api/v1/teams/${params.teamId}`,
		{
			fields: ['teams,id,name,franchiseName,clubName,teamName,abbreviation', 'sport'],
		},
		{ fetch },
	)

	const roster = await fetchMLB<MLB.RosterResponse>(
		`/api/v1/teams/${params.teamId}/roster`,
		{
			fields: ['roster', 'person,id,lastName,lastFirstName', 'position,code,abbreviation'],
			hydrate: 'person',
		},
		{ fetch },
	)

	const coaches = await fetchMLB<MLB.CoachesResponse>(
		`/api/v1/teams/${params.teamId}/coaches`,
		{
			fields: ['roster', 'person,id,lastName,lastFirstName', 'job'],
			hydrate: 'person',
		},
		{ fetch },
	)

	return {
		team: teams.teams[0],
		roster,
		coaches,
	}
}
