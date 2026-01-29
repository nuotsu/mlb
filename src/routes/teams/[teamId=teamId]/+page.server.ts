import { fetchMLB } from '$lib/fetch'
import { getToday } from '$lib/temporal'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
	const teams = await fetchMLB<MLB.TeamsResponse>(`/api/v1/teams/${params.teamId}`, {
		fields: ['teams,id,name,locationName,teamName'],
	})

	const schedule = await fetchMLB<MLB.ScheduleResponse>(`/api/v1/schedule`, {
		sportId: '1',
		teamId: params.teamId,
		season: getToday().getFullYear().toString(),
		fields: [
			'dates,date',
			'games,gamePk,gameDate',
			'teams,home,away,team,id,name,abbreviation',
			'venue',
		],
		hydrate: 'team',
	})

	return {
		team: teams.teams[0],
		schedule,
	}
}
