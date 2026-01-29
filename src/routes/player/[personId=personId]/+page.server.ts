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
		],
		hydrate: 'currentTeam,preferredTeam',
	})

	const [person] = data.people

	return {
		person,
	}
}
