import { cacheControlForSeasonPage } from '$lib/cache-control'
import { fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': cacheControlForSeasonPage(params.season) })

	const hittingSortStat = url.searchParams.get('hittingSortStat') ?? 'homeRuns'
	const pitchingSortStat = url.searchParams.get('pitchingSortStat') ?? 'era'
	const gameType = url.searchParams.get('gameType') ?? 'R'
	const sportId = url.searchParams.get('sportId') ?? '1'
	const position = url.searchParams.get('position')

	const [baseballStats, hittingLeaders, pitchingLeaders, positions, { leagues }, seasonInfo] = await Promise.all([
		fetchMLB<MLB.BaseballStat[]>('/api/v1/baseballStats', undefined, { fetch }),
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
				'team,league,name,sport',
			],
			gameType,
			sportId,
			...(position ? { position } : {}),
		}, { fetch }),
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
				'team,league,name,sport',
			],
			gameType,
			sportId,
			...(position ? { position } : {}),
		}, { fetch }),
		fetchMLB<MLB.PositionMeta[]>('/api/v1/positions', undefined, { fetch }),
		fetchMLB<MLB.LeaguesResponse>(
			'/api/v1/leagues',
			{ season: params.season, fields: 'leagues,id,divisionsInUse,sport,id' },
			{ fetch },
		),
		fetchMLB<MLB.SeasonResponse>(
			'/api/v1/seasons',
			{
				sportId,
				season: params.season,
				fields: 'seasons,springStartDate,regularSeasonStartDate,postSeasonStartDate',
			},
			{ fetch },
		).then((r) => r.seasons?.[0]),
	])

	const availableGameTypes = [
		seasonInfo?.springStartDate && 'S',
		seasonInfo?.regularSeasonStartDate && 'R',
		seasonInfo?.postSeasonStartDate && 'P',
	].filter(Boolean) as string[]

	const availableSportIds = [
		...new Set(
			leagues
				.filter((l) => (gameType === 'S' ? !l.divisionsInUse : l.divisionsInUse))
				.map((l) => l.sport?.id)
				.filter(Boolean),
		),
	] as number[]

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
		availableSportIds,
		availableGameTypes,
	}
}
