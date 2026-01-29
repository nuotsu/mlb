import { fetchMLB } from '$lib/fetch'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
	const data = await fetchMLB<MLB.TeamsResponse>(`/api/v1/teams/${params.teamId}`)
	const [team] = data.teams

	return {
		team,
	}
}
