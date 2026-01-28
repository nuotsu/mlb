import { fetchMLB } from '$lib/fetch'
import { getToday } from '$lib/temporal'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url }) => {
	const params = Object.fromEntries(url.searchParams.entries())

	const standings = await fetchMLB<MLB.StandingsResponse>('/api/v1/standings', {
		leagueId: '103,104',
		season: getToday().getFullYear().toString(),
		hydrate: 'division,team',
		fields: [
			'records,division,nameShort',
			'teamRecords,wins,losses,winningPercentage,sportGamesBack,magicNumber,streak,streakCode,leagueRank',
			'team,id,name,teamName,abbreviation',
		],
		...params,
	})

	return {
		standings,
	}
}
