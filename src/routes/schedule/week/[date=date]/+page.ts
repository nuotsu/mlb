import { fetchMLB } from '$lib/fetch'
import { formatDate } from '$lib/temporal'
import { getWeekDates } from '$ui/schedule/store.svelte'

export const load = async ({ params, url }) => {
	const sportId = url.searchParams.get('sportId') || '1'

	const { startDate, endDate } = getWeekDates(params.date)

	const schedule = await fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
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
			'teams,home,away',
		],
		hydrate: 'teams,flags,linescore',
	})

	return {
		schedule,
	}
}
