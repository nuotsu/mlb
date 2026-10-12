import { error } from '@sveltejs/kit'
import { cacheControlForGame } from '#lib/cache-control.js'
import { fetchMLB } from '#lib/fetch/index.js'
import {
	fetchBoxscore,
	fetchfeedLive,
	fetchGameSnapshot,
	fetchWinProbability,
} from '#lib/fetch/presets.js'
import { DELAY_PARAM, parseDelay, toTimecode } from '#lib/time-travel.js'
import { batterUniforms } from '#lib/uniforms.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, url, fetch, setHeaders }) => {
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
				'broadcasts,callSign,isNational',
			],
			hydrate: 'flags,broadcasts(all)',
		},
		{ fetch },
	)

	const game = schedule?.dates?.[0]?.games.find((g) => g.gamePk === Number(params.gamePk))
	if (!game) {
		setHeaders({ 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800' })
		error(404, 'Game not found')
	}

	const state = game.status.abstractGameState
	const isFinal = state === 'Final'
	const isLive = state === 'Live'

	// A delayed page is pinned to "now − delay", so it's only good for this request
	const delay = isLive || isFinal ? parseDelay(url.searchParams.get(DELAY_PARAM)) : null
	setHeaders({ 'cache-control': delay ? 'private, no-store' : cacheControlForGame(state) })

	// Delayed pages get the game as of "now − delay" and nothing newer, not even in the
	// hydration payload; the live data is loaded once the delay is cleared
	const showLive = (isLive || isFinal) && !delay

	const [snapshotResult, feedLiveResult, boxscoreResult, contentResult, uniformsResult] =
		await Promise.allSettled([
			delay ? fetchGameSnapshot(params.gamePk, toTimecode(Date.now() - delay), { fetch }) : null,
			showLive ? fetchfeedLive(params.gamePk) : Promise.resolve(null),
			delay ? Promise.resolve(null) : fetchBoxscore(params.gamePk),
			fetchMLB<MLB.GameContent>(`/api/v1/game/${params.gamePk}/content`, undefined, { fetch }),
			// Uniforms are set before first pitch, so live games don't need to poll them
			isLive || isFinal
				? fetchMLB<MLB.UniformsResponse>(
						'/api/v1/uniforms/game',
						{ gamePks: params.gamePk },
						{ fetch },
					)
				: Promise.resolve(null),
		])

	const snapshot = snapshotResult.status === 'fulfilled' ? snapshotResult.value : null

	const feedLive = feedLiveResult.status === 'fulfilled' ? feedLiveResult.value : null
	const boxscore = boxscoreResult.status === 'fulfilled' ? boxscoreResult.value : null
	const content = contentResult.status === 'fulfilled' ? contentResult.value : null
	const uniforms = batterUniforms(
		uniformsResult.status === 'fulfilled' ? uniformsResult.value : null,
		game.gamePk,
	)

	const winProbability = showLive
		? await fetchWinProbability(params.gamePk).catch(() => null)
		: null

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
					sportId: '1',
					teamId: String(homeTeamId),
					startDate: startDateStr,
					endDate: officialDate,
					fields: [
						'dates,games,gamePk,gamesInSeries',
						'status,abstractGameState',
						'teams,home,away,team,id,score',
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
				homeWins: seriesGames.filter((g) => (g.teams.home.score ?? 0) > (g.teams.away.score ?? 0))
					.length,
				awayWins: seriesGames.filter((g) => (g.teams.away.score ?? 0) > (g.teams.home.score ?? 0))
					.length,
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
		uniforms,
		seriesRecord,
		snapshot,
	}
}
