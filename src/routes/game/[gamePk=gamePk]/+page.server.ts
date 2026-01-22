import { fetchBoxscore, fetchfeedLive, fetchMLB } from '$lib/fetch'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
	const schedule = await fetchMLB<MLB.ScheduleResponse>(`/api/v1/schedule`, {
		gamePk: params.gamePk,
		fields: [
			'dates,date,venue,description,seriesGameNumber,gamesInSeries',
			'games,gamePk,gameType,gameDate,link',
			'flags,noHitter,perfectGame',
			'status,abstractGameState,detailedState,reason',
			'teams,away,home,team,id,name,leagueRecord,wins,losses,score',
		],
		hydrate: 'flags',
	})

	const game = schedule.dates[0].games.find((game) => game.gamePk === Number(params.gamePk))!

	const feedLive = await fetchfeedLive(params.gamePk)
	const boxscore = await fetchBoxscore(params.gamePk)

	const winProbability = await fetchMLB<MLB.PlayWinProbability[]>(
		`/api/v1/game/${params.gamePk}/winProbability`,
		{ fields: 'result,homeTeamWinProbability,awayTeamWinProbability' },
	)

	return {
		game,
		feedLive,
		boxscore,
		winProbability,
	}
}
