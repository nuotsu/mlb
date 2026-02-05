import { fetchMLB } from '$lib/fetch'
import { formatDate } from '$lib/temporal'
import { getWeekDates } from '$ui/schedule/store.svelte'

export async function fetchWeekSchedule(date: string, sportId = '1') {
	const { startDate, endDate } = getWeekDates(date)

	return fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
		sportId,
		startDate: formatDate(startDate, {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}),
		endDate: formatDate(endDate, {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}),
		fields: [
			'dates,date,venue,description,seriesGameNumber,gamesInSeries',
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
