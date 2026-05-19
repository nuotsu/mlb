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

	return {
		schedule,
		game,
		feedLive,
		boxscore,
		winProbability,
		content,
	}
}
