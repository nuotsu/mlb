import { fetchMLB } from '$lib/fetch'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
	const schedule = await fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
		sportId: '1',
		date: params.date,
		fields:
			'totalGames,dates,date,games,gamePk,gameType,gameDate,status,abstractGameState,detailedState,teams,away,home,team,id,name,leagueRecord,wins,losses,venue,description',
		hydrate: 'teams',
	})

	return {
		schedule,
	}
}
