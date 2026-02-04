import { fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url }) => {
	const searchParams = Object.fromEntries(url.searchParams.entries())
	const sortStats = (url.searchParams.get('sortStat') ?? 'homeRuns,era').split(',')
	const [hittingSortStat, pitchingSortStat] = [sortStats[0] ?? 'homeRuns', sortStats[1] ?? 'era']

	const [baseballStats, hittingLeaders, pitchingLeaders, positions] = await Promise.all([
		fetchMLB<MLB.BaseballStat[]>('/api/v1/baseballStats'),
		fetchMLB<MLB.PlayerStatsResponse>('/api/v1/stats', {
			stats: 'season',
			group: 'hitting',
			sortStat: hittingSortStat,
			season: params.season,
			limit: '20',
			fields: [
				'stats,splits,rank',
				'player,id,lastName,position,abbreviation',
				'stat,avg,homeRuns,rbi,hits,doubles,triples,stolenBases,obp,slg,ops',
				'team,league,name',
			],
			...searchParams,
		}),
		fetchMLB<MLB.PlayerStatsResponse>('/api/v1/stats', {
			stats: 'season',
			group: 'pitching',
			sortStat: pitchingSortStat,
			season: params.season,
			limit: '20',
			fields: [
				'stats,splits,rank',
				'player,id,lastName,position,abbreviation',
				'stat,era,wins,losses,strikeOuts,saves,whip,inningsPitched',
				'team,league,name',
			],
			...searchParams,
		}),
		fetchMLB<MLB.PositionMeta[]>('/api/v1/positions'),
	])

	return {
		baseballStats,
		hittingLeaders: {
			sortStat: hittingSortStat,
			...hittingLeaders,
		},
		pitchingLeaders: {
			sortStat: pitchingSortStat,
			...pitchingLeaders,
		},
		positions,
	}
}
