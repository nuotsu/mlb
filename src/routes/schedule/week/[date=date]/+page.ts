import { fetchMLB } from '$lib/fetch'
import { formatDate } from '$lib/temporal'
import { weekStore } from '$ui/schedule/store.svelte'

export const load = async ({ params, url }) => {
	const sportId = url.searchParams.get('sportId') || '1'

	weekStore.today = params.date

	const schedule = await fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
		sportId,
		startDate: formatDate(weekStore.startDate, {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}),
		endDate: formatDate(weekStore.endDate, {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}),
		fields: [
			'dates,date,venue,description,seriesGameNumber,gamesInSeries',
			'games,gamePk,gameType,gameDate',
			'status,abstractGameState,detailedState,reason',
			'teams,away,home,team,id,name,leagueRecord,wins,losses,score',
		],
		hydrate: 'teams',
	})

	return {
		schedule,
	}
}
