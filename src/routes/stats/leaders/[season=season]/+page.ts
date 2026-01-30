import { fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url }) => {
	const searchParams = Object.fromEntries(url.searchParams.entries())

	const leaders = await fetchMLB<MLB.StatsLeadersResponse>('/api/v1/stats/leaders', {
		leaderCategories: 'homeRuns',
		season: params.season,
		...searchParams,
	})

	return {
		leaders,
	}
}
