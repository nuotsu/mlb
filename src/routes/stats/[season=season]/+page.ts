import { fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url }) => {
	const searchParams = Object.fromEntries(url.searchParams.entries())
	const sortStat = url.searchParams.get('sortStat') ?? 'avg'

	const statsList = await fetchMLB<MLB.BaseballStat[]>('/api/v1/baseballStats')

	const hittingLeaders = await fetchMLB<MLB.PlayerStatsResponse>('/api/v1/stats', {
		stats: 'season',
		group: 'hitting',
		sortStat,
		season: params.season,
		limit: '10',
		fields: [],
		...searchParams,
	})

	return {
		statsList,
		hittingLeaders: {
			sortStat,
			...hittingLeaders,
		},
	}
}
