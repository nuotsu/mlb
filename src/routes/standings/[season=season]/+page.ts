import { fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url }) => {
	const searchParams = Object.fromEntries(url.searchParams.entries())

	const standings = await fetchMLB<MLB.StandingsResponse>('/api/v1/standings', {
		leagueId: '103,104',
		season: params.season,
		hydrate: 'division,team',
		fields: [
			'records,division,nameShort',
			'teamRecords,wins,losses,winningPercentage,sportGamesBack,magicNumber,streak,streakCode,leagueRank',
			'team,id,name,clubName,teamName,abbreviation',
		],
		...searchParams,
	})

	return {
		standings,
	}
}
