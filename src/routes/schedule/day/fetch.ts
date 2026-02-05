import { fetchMLB } from '$lib/fetch'

export async function fetchDaySchedule(date: string, sportId = '1') {
	return fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
		sportId,
		date,
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
}
