import { cacheControlForSeasonPage } from '#lib/cache-control.js'
import { filterKboSchedule, KBO_SCHEDULE_URL } from '#lib/kbo-schedule.js'
import {
	getKboSchedule,
	isRecentKboDate,
	KboNotFoundError,
	withKboScheduleDetails,
} from '#lib/server/kbo.js'
import type { RequestHandler } from './$types'

function error(status: number, message: string) {
	return Response.json(
		{ message },
		{ status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
	)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Linescores take a request to koreabaseball.com per day and game, so they're only for a week */
const MAX_LINESCORE_DAYS = 7

/** While any game in range may still change, as `cacheControlForKboGame` has it for a live one */
const LIVE_CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=60'

/**
 * KBO's schedule for a season (regular season, postseason and All-Star Game), parsed from
 * koreabaseball.com, optionally narrowed to `?startDate=&endDate=` (`YYYY-MM-DD`, inclusive)
 * and/or one `?teamId=` (Stats API team ID). `?linescores=1` adds each day's game list and each
 * game's scoreboard, for a range of up to a week. Cached at the CDN, and in memory per season
 * (see `getKboSchedule`), day and game.
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const season = Number(params.season)
	const startDate = url.searchParams.get('startDate') ?? undefined
	const endDate = url.searchParams.get('endDate') ?? undefined
	const teamId = url.searchParams.get('teamId') ?? undefined
	const linescores = url.searchParams.get('linescores') === '1'

	if (
		(startDate && !ISO_DATE.test(startDate)) ||
		(endDate && !ISO_DATE.test(endDate)) ||
		(teamId && !/^\d+$/.test(teamId))
	) {
		return error(400, 'startDate and endDate take YYYY-MM-DD, and teamId a number.')
	}

	if (
		linescores &&
		(!startDate ||
			!endDate ||
			(Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 >= MAX_LINESCORE_DAYS)
	) {
		return error(
			400,
			`linescores needs a startDate and endDate at most ${MAX_LINESCORE_DAYS} days apart.`,
		)
	}

	try {
		const schedule = await getKboSchedule(season)
		const games = filterKboSchedule(schedule.games, {
			startDate,
			endDate,
			teamId: teamId ? Number(teamId) : undefined,
		})
		const detailed = linescores ? await withKboScheduleDetails(games) : games
		const mayChange = detailed.some(({ date }) => isRecentKboDate(date))

		return Response.json(
			{
				season,
				source: KBO_SCHEDULE_URL,
				allStarDates: schedule.allStarDates,
				games: detailed,
			},
			{
				headers: {
					'Cache-Control':
						linescores && mayChange ? LIVE_CACHE_CONTROL : cacheControlForSeasonPage(season),
					'X-Robots-Tag': 'noindex',
				},
			},
		)
	} catch (e) {
		if (e instanceof KboNotFoundError) return error(404, e.message)
		if (e instanceof Error && e.name === 'TimeoutError') {
			return error(504, 'koreabaseball.com did not respond in time.')
		}

		return error(502, `Could not load the KBO schedule (${e instanceof Error ? e.message : e}).`)
	}
}
