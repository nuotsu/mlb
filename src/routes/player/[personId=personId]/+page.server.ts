import { fetchMLB } from '$lib/fetch'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
	const personId = params.personId

	const data = await fetchMLB<MLB.PersonResponse>(`/api/v1/people/${personId}`, {
		fields: [
			'people',
			'id,fullName,firstName,lastName,useName,useLastName',
			'primaryNumber,primaryPosition,abbreviation,active',
			'currentTeam,preferredTeam,team,name',
			'stats,group,displayName,splits,season,stat',
			'avg,homeRuns,rbi,hits,stolenBases,slg',
		],
		hydrate: ['currentTeam,preferredTeam', 'stats(group=[pitching,hitting],type=[yearByYear])'],
	})

	const [person] = data.people

	return {
		person,
	}
}
