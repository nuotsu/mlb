import { fetchMLB } from '$lib/fetch'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
	const personId = params.personId

	const data = await fetchMLB<MLB.PersonResponse>(`/api/v1/people/${personId}`)
	const [person] = data.people

	return {
		person,
	}
}
