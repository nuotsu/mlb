import { fetchBoxscore, fetchLinescore, fetchMLB } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params }) => {
	const game = await fetchMLB<MLB.ScheduleResponse>(`/api/v1/schedule`, {
		gamePk: params.gamePk,
		fields: [
			'dates,date,venue,description,seriesGameNumber,gamesInSeries',
			'games,gamePk,gameType,gameDate',
			'status,abstractGameState,detailedState,reason',
			'teams,away,home,team,id,name,leagueRecord,wins,losses,score',
		],
	})

	const boxscore = await fetchBoxscore(params.gamePk)
	const linescore = await fetchLinescore(params.gamePk)

	return {
		game,
		boxscore,
		linescore,
	}
}
