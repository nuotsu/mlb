import { fetchMLB } from '$lib/fetch'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
	const personId = params.personId

	const [statsList, data] = await Promise.all([
		fetchMLB<MLB.BaseballStat[]>('/api/v1/baseballStats'),
		fetchMLB<MLB.PersonResponse>(`/api/v1/people/${personId}`, {
			fields: [
				'people',
				'id,fullName,firstName,lastName,useName,useLastName',
				'primaryNumber,primaryPosition,abbreviation,active',
				'currentTeam,preferredTeam,team,name,teamName',
				'stats,group,displayName,splits,season,stat',
				'avg,homeRuns,rbi,hits,doubles,triples,baseOnBalls,stolenBases,slg',
				'era,wins,losses,strikeOuts,baseOnBalls,hitBatsmen,saves,whip,inningsPitched',
				'type,zones,zone,color,temp,value',
			],
			hydrate: [
				'team,currentTeam,preferredTeam',
				'stats(group=[pitching,hitting],type=[yearByYear,hotColdZones])',
			],
		}),
	])

	const [person] = data.people

	return {
		statsList,
		person,
	}
}
