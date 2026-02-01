import { fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url }) => {
	const sortStats = (url.searchParams.get('sortStat') ?? 'avg,era').split(',')
	const [hittingSortStat, pitchingSortStat] = [sortStats[0] ?? 'avg', sortStats[1] ?? 'era']

	const statsList = await fetchMLB<MLB.BaseballStat[]>('/api/v1/baseballStats')

	const [hittingLeaders, pitchingLeaders] = await Promise.all([
		fetchMLB<MLB.PlayerStatsResponse>('/api/v1/stats', {
			stats: 'season',
			group: 'hitting',
			sortStat: hittingSortStat,
			season: params.season,
			limit: '10',
			fields: [
				'stats,splits',
				'player,id,lastName',
				'stat,avg,homeRuns,rbi,hits,doubles,triples,stolenBases,obp,slg,ops',
				'team,league,name',
			],
		}),
		fetchMLB<MLB.PlayerStatsResponse>('/api/v1/stats', {
			stats: 'season',
			group: 'pitching',
			sortStat: pitchingSortStat,
			season: params.season,
			limit: '10',
			fields: [
				'stats,splits',
				'player,id,lastName',
				'stat,era,wins,losses,strikeOuts,saves,whip,inningsPitched',
				'team,league,name',
			],
		}),
	])

	return {
		statsList,
		hittingLeaders: {
			sortStat: hittingSortStat,
			...hittingLeaders,
		},
		pitchingLeaders: {
			sortStat: pitchingSortStat,
			...pitchingLeaders,
		},
	}
}
