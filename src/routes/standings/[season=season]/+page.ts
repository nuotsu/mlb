import { cacheControlForSeasonPage } from '$lib/cache-control'
import { fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url, setHeaders }) => {
	setHeaders({ 'cache-control': cacheControlForSeasonPage(params.season) })

	const sportId = url.searchParams.get('sportId') ?? '1'
	const gameType = url.searchParams.get('gameType') ?? 'R'

	const [{ leagues: allLeagues }, seasonInfo] = await Promise.all([
		fetchMLB<MLB.LeaguesResponse>(
			'/api/v1/leagues',
			{ season: params.season, fields: 'leagues,id,divisionsInUse,sport,id' },
		),
		fetchMLB<MLB.SeasonResponse>(
			'/api/v1/seasons',
			{
				sportId,
				season: params.season,
				fields: 'seasons,springStartDate,regularSeasonStartDate,postSeasonStartDate',
			},
		).then((r) => r.seasons?.[0]),
	])

	const availableGameTypes = [
		seasonInfo?.springStartDate && 'S',
		seasonInfo?.regularSeasonStartDate && 'R',
		seasonInfo?.postSeasonStartDate && 'P',
	].filter(Boolean) as string[]

	const matchesGameType = (l: MLB.League) => (gameType === 'S' ? !l.divisionsInUse : l.divisionsInUse)

	const leagueId = allLeagues
		.filter((l) => l.sport?.id === Number(sportId) && matchesGameType(l))
		.map((l) => l.id)
		.join(',')

	const availableSportIds = [
		...new Set(allLeagues.filter(matchesGameType).map((l) => l.sport?.id).filter(Boolean)),
	] as number[]

	const standings = await fetchMLB<MLB.StandingsResponse>(
		'/api/v1/standings',
		{
			leagueId,
			season: params.season,
			standingsType:
				gameType === 'S' ? 'springTraining' : gameType === 'P' ? 'postseason' : 'regularSeason',
			hydrate: 'division,team',
			fields: [
				'records,sport,division,nameShort,league,springLeague,id,name',
				'teamRecords,wins,losses,winningPercentage,gamesBack,magicNumber,streak,streakCode,leagueRank',
				'team,id,name,clubName,teamName,abbreviation',
			],
		},
	)

	return {
		standings,
		availableGameTypes,
		availableSportIds,
	}
}
