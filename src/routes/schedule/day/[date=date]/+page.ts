import { fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url }) => {
	const sportId = url.searchParams.get('sportId') || '1'

	const schedule = await fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
		sportId,
		date: params.date,
		fields: [
			'totalGames,dates,date,venue,description,seriesGameNumber,gamesInSeries',
			'games,gamePk,gameType,gameDate',
			'status,abstractGameState,detailedState,reason',
			'flags,noHitter,perfectGame',
			'teams,away,home,team,id,name,leagueRecord,wins,losses,score',
			// linescore
			'linescore,currentInning,scheduledInnings',
			'innings,num,runs,hits,errors,leftOnBase',
		],
		hydrate: 'teams,flags,linescore',
	})

	return {
		schedule,
	}
}
