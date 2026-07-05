import { fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' })

	const searchParams = Object.fromEntries(url.searchParams.entries())

	const teams = await fetchMLB<MLB.TeamsResponse>('/api/v1/teams', {
		sportId: '1',
		fields: [
			'teams,id,name,abbreviation',
			'sport,abbreviation',
			'league,name,division,sortOrder,nameShort',
		],
		hydrate: 'sport,division',
		...searchParams,
	}, { fetch })

	return {
		teams,
	}
}
