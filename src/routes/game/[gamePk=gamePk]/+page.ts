import { fetchBoxscore, fetchLinescore, fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params }) => {
	const schedule = await fetchMLB<MLB.ScheduleResponse>(`/api/v1/schedule`, {
		gamePk: params.gamePk,
		fields: [
			'dates,date,venue,description,seriesGameNumber,gamesInSeries',
			'games,gamePk,gameType,gameDate,link',
			'status,abstractGameState,detailedState,reason',
			'teams,away,home,team,id,name,leagueRecord,wins,losses,score',
		],
	})

	const game = schedule.dates[0].games.find((game) => game.gamePk === Number(params.gamePk))!

	const feedLive = await fetchMLB<MLB.LiveGameFeed>(game?.link, {
		fields: ['gameData', 'gameInfo,attendance,gameDurationMinutes', 'weather,condition,temp,wind'],
	})

	const boxscore = await fetchBoxscore(params.gamePk)
	const linescore = await fetchLinescore(params.gamePk)

	return {
		game,
		feedLive,
		boxscore,
		linescore,
	}
}
