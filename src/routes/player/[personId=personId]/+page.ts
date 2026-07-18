import { fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' })

	const personId = params.personId

	const [person, baseballStats] = await Promise.all([
		fetchMLB<MLB.PersonResponse>(
			`/api/v1/people/${personId}`,
			{
				// fields: [
				// 	'people',
				// 	'id,fullName,firstName,lastName,useName,useLastName',
				// 	'birthDate,currentAge,birthCity,birthCountry',
				// 	'primaryNumber,primaryPosition,abbreviation,active',
				// 	'currentTeam,preferredTeam,team,name,clubName,teamName',
				// 	'rosterEntries,status,code,description,parentOrgId,mlbDebutDate',
				// 	'drafts,pickRound,pickNumber,year,signingBonus',
				// 	'stats,group,displayName,splits,season,stat',
				// 	'avg,homeRuns,rbi,hits,doubles,triples,baseOnBalls,stolenBases,slg',
				// 	'era,wins,losses,strikeOuts,baseOnBalls,hitBatsmen,saves,whip,inningsPitched',
				// 	'type,zones,zone,color,temp,value',
				// ],
				hydrate: [
					'team,currentTeam,preferredTeam,rosterEntries,draft,relatives',
					'stats(group=[pitching,hitting],type=[yearByYear,career])',
				],
			},
			{ fetch },
		),
		fetchMLB<MLB.BaseballStat[]>('/api/v1/baseballStats', undefined, { fetch }),
	])

	return {
		person: person.people?.[0],
		baseballStats,
	}
}
