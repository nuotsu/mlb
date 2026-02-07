import { fetchMLB } from '$lib/fetch'
import { getToday } from '$lib/temporal'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, url }) => {
	const searchParams = Object.fromEntries(url.searchParams.entries())

	const teams = await fetchMLB<MLB.TeamsResponse>(`/api/v1/teams/${params.teamId}`, {
		fields: ['teams,id,name,franchiseName,clubName,teamName', 'sport'],
	})

	const sportId = (teams.teams[0] as MLB.TeamDetailed)?.sport?.id.toString()

	const schedule = await fetchMLB<MLB.ScheduleResponse>(`/api/v1/schedule`, {
		sportId: sportId ?? '1',
		teamId: params.teamId,
		season: getToday().getFullYear().toString(),
		fields: [
			'dates,date',
			'games,gamePk,gameDate',
			'teams,home,away,team,id,name,clubName,teamName,abbreviation',
			'venue,sport,name',
		],
		hydrate: 'team',
		...searchParams,
	})

	const roster = await fetchMLB<MLB.RosterResponse>(`/api/v1/teams/${params.teamId}/roster`, {
		fields: ['roster', 'person,id,lastInitName', 'jerseyNumber,position,code,abbreviation'],
		hydrate: 'person',
	})

	const coaches = await fetchMLB<MLB.CoachesResponse>(`/api/v1/teams/${params.teamId}/coaches`, {
		fields: ['roster', 'person,id,lastInitName', 'jerseyNumber,job'],
		hydrate: 'person',
	})

	return {
		team: teams.teams[0],
		schedule,
		roster,
		coaches,
	}
}
