import { fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url }) => {
	const searchParams = Object.fromEntries(url.searchParams.entries())

	const teams = await fetchMLB<MLB.TeamsResponse>('/api/v1/teams', {
		sportId: '1',
		fields: ['teams,id,name,abbreviation', 'sport,abbreviation', 'league,name,division,nameShort'],
		hydrate: 'sport,division',
		...searchParams,
	})

	return {
		teams,
	}
}
