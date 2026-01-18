import { fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url }) => {
	const sportId = url.searchParams.get('sportId') || '1'

	const schedule = await fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
		sportId,
		date: params.date,
		fields:
			'totalGames,dates,date,games,gamePk,gameType,gameDate,status,abstractGameState,detailedState,teams,away,home,team,id,name,leagueRecord,wins,losses,venue,description',
		hydrate: 'teams',
	})

	return {
		schedule,
	}
}
