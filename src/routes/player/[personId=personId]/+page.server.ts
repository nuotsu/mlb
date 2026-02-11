import { fetchMLB } from '$lib/fetch'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
	const personId = params.personId

	const [person, hittingStats, pitchingStats, baseballStats] = await Promise.all([
		fetchMLB<MLB.PersonResponse>(`/api/v1/people/${personId}`, {
			fields: [
				'people',
				'id,fullName,firstName,lastName,useName,useLastName',
				'birthDate,currentAge,birthCity,birthCountry',
				'primaryNumber,primaryPosition,abbreviation,active',
				'currentTeam,preferredTeam,team,name,clubName,teamName',
				'rosterEntries,status,code,description,parentOrgId',
				'stats,group,displayName,splits,season,stat',
				'avg,homeRuns,rbi,hits,doubles,triples,baseOnBalls,stolenBases,slg',
				'era,wins,losses,strikeOuts,baseOnBalls,hitBatsmen,saves,whip,inningsPitched',
				'type,zones,zone,color,temp,value',
			],
			hydrate: [
				'team,currentTeam,preferredTeam,rosterEntries',
				'stats(group=[pitching,hitting],type=[yearByYear])',
			],
		}),
		fetchMLB<MLB.PlayerStatsResponse>(`/api/v1/people/${personId}/stats`, {
			stats: 'hotColdZones',
			group: 'hitting',
		}),
		fetchMLB<MLB.PlayerStatsResponse>(`/api/v1/people/${personId}/stats`, {
			stats: 'hotColdZones',
			group: 'pitching',
		}),
		fetchMLB<MLB.BaseballStat[]>('/api/v1/baseballStats'),
	])

	return {
		person: person.people?.[0],
		hittingHotColdZones: hittingStats.stats?.[0],
		pitchingHotColdZones: pitchingStats.stats?.[0],
		baseballStats,
	}
}
