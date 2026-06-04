import { fetchMLB } from '$lib/fetch'
import { fetchBoxscore, fetchfeedLive, fetchWinProbability } from '$lib/fetch/presets'
import { cacheControlForGame } from '$lib/cache-control'
import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
	const schedule = await fetchMLB<MLB.ScheduleResponse>(
		`/api/v1/schedule`,
		{
			gamePk: params.gamePk,
			fields: [
				'dates,date,venue,description,seriesGameNumber,gamesInSeries',
				'games,gamePk,gameType,gameDate,link',
				'flags,noHitter,perfectGame',
				'status,abstractGameState,detailedState,reason',
				'teams,away,home,team,id,name,leagueRecord,wins,losses,score',
			],
			hydrate: 'flags',
		},
		{ fetch },
	)

	const game = schedule?.dates?.[0]?.games.find((g) => g.gamePk === Number(params.gamePk))
	if (!game) {
		setHeaders({ 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800' })
		error(404, 'Game not found')
	}

	const state = game.status.abstractGameState
	setHeaders({ 'cache-control': cacheControlForGame(state) })

	const isFinal = state === 'Final'
	const isLive = state === 'Live'

	const [feedLiveResult, boxscoreResult, contentResult] = await Promise.allSettled([
		isLive || isFinal ? fetchfeedLive(params.gamePk) : Promise.resolve(null),
		fetchBoxscore(params.gamePk),
		fetchMLB<MLB.GameContent>(`/api/v1/game/${params.gamePk}/content`, undefined, { fetch }),
	])

	const feedLive = feedLiveResult.status === 'fulfilled' ? feedLiveResult.value : null
	const boxscore = boxscoreResult.status === 'fulfilled' ? boxscoreResult.value : null
	const content = contentResult.status === 'fulfilled' ? contentResult.value : null

	const winProbability = isLive || isFinal ? await fetchWinProbability(params.gamePk).catch(() => null) : null

	let seriesRecord: { homeWins: number; awayWins: number } | null = null
	if (game.gamesInSeries && game.gamesInSeries > 1) {
		try {
			const officialDate = game.officialDate || game.gameDate.split('T')[0]
			const startDate = new Date(officialDate)
			startDate.setDate(startDate.getDate() - 7)
			const startDateStr = startDate.toISOString().split('T')[0]

			const homeTeamId = game.teams.home.team.id
			const awayTeamId = game.teams.away.team.id

			const seriesSchedule = await fetchMLB<MLB.ScheduleResponse>(
				'/api/v1/schedule',
				{
					sportId: 1,
					teamId: homeTeamId,
					startDate: startDateStr,
					endDate: officialDate,
					fields: [
						'dates,games,gamePk,gamesInSeries',
						'status,abstractGameState',
						'teams,home,away,team,id,isWinner',
					],
				},
				{ fetch },
			)

			const allGames = seriesSchedule?.dates?.flatMap((d) => d.games) ?? []
			const seriesGames = allGames.filter(
				(g) =>
					g.gamesInSeries === game.gamesInSeries &&
					g.teams.home.team.id === homeTeamId &&
					g.teams.away.team.id === awayTeamId &&
					g.status.abstractGameState === 'Final',
			)

			seriesRecord = {
				homeWins: seriesGames.filter((g) => g.teams.home.isWinner).length,
				awayWins: seriesGames.filter((g) => g.teams.away.isWinner).length,
			}
		} catch {
			seriesRecord = null
		}
	}

	return {
		schedule,
		game,
		feedLive,
		boxscore,
		winProbability,
		content,
		seriesRecord,
	}
}
