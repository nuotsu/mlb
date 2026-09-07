import { cacheControlForSeasonPage } from '$lib/cache-control'
import { fetchMLB } from '$lib/fetch'
import { buildBracket, leagueSide, type TeamInfo } from '$lib/postseason/bracket'
import { getToday } from '$lib/temporal'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, setHeaders }) => {
	const season = Number(params.season)
	const isCurrentSeason = season === getToday().getFullYear()

	const [series, teams, standings] = await Promise.all([
		fetchMLB<MLB.PostseasonSeriesResponse>('/api/v1/schedule/postseason/series', {
			sportId: '1',
			season: params.season,
			fields: [
				'totalItems,totalGames,totalGamesInProgress,series,id,sortNumber,gameType',
				'games,gamePk,gameDate,officialDate,status,abstractGameState,codedGameState',
				'teams,away,home,team,id,name,isWinner,score',
				'gamesInSeries,seriesGameNumber,description,seriesDescription',
			],
		}).catch(() => null),
		// Team names and leagues as of that season, so relocated franchises read correctly.
		fetchMLB<MLB.TeamsResponse>('/api/v1/teams', {
			sportId: '1',
			season: params.season,
			fields: 'teams,id,name,teamName,clubName,abbreviation,league,name',
		}).catch(() => null),
		// Only the current season can be projected; past seasons are what MLB published.
		isCurrentSeason
			? fetchMLB<MLB.StandingsResponse>('/api/v1/standings', {
					leagueId: '103,104',
					season: params.season,
					standingsType: 'regularSeason',
					fields: [
						'records,league,id,teamRecords,team,name',
						'divisionLeader,wildCardRank,leagueRank,clinched,wins,losses,winningPercentage',
					],
				}).catch(() => null)
			: null,
	])

	const teamInfo = new Map<number, TeamInfo>(
		(teams?.teams ?? []).map((team) => [
			team.id,
			{ team, league: leagueSide((team as MLB.TeamDetailed).league?.id) },
		]),
	)

	const bracket = buildBracket({ season, series, teams: teamInfo, standings })

	setHeaders({
		'cache-control': bracket?.live
			? 'public, s-maxage=60, stale-while-revalidate=120'
			: cacheControlForSeasonPage(params.season),
	})

	return { bracket }
}
