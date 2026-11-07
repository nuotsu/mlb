import { cacheControlForSeasonPage, getScheduleToday } from '#lib/cache-control.js'
import { filterNpbSchedule } from '#lib/npb-schedule.js'
import {
	getNpbSchedule,
	isRecentNpbGame,
	NpbNotFoundError,
	withNpbScheduleLinescores,
} from '#lib/server/npb.js'
import type { RequestHandler } from './$types'

function error(status: number, message: string) {
	return Response.json(
		{ message },
		{ status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
	)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Linescores take a request to npb.jp per game, so they're only for a week or less */
const MAX_LINESCORE_DAYS = 7

/** While any game in range may still change, as `cacheControlForNpbGame` has it for a live one */
const LIVE_CACHE_CONTROL = 'public, s-maxage=30, stale-while-revalidate=60'

/**
 * NPB's regular season schedule for a season, parsed from npb.jp, optionally narrowed to
 * `?startDate=&endDate=` (`YYYY-MM-DD`, inclusive) and/or one `?teamId=` (Stats API team ID).
 * `?linescores=1` adds each game's linescore from its own page, for a range of up to a week.
 * Cached at the CDN, and in memory per season (see `getNpbSchedule`) and game.
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
		const schedule = await getNpbSchedule(season)
		const games = filterNpbSchedule(schedule.games, {
			startDate,
			endDate,
			teamId: teamId ? Number(teamId) : undefined,
		})
		const withLinescores = linescores ? await withNpbScheduleLinescores(games) : games
		const mayChange = withLinescores.some(({ ref }) => isRecentNpbGame(ref, getScheduleToday()))

		return Response.json(
			{
				season,
				source: 'https://npb.jp/games/',
				allStarDates: schedule.allStarDates,
				games: withLinescores,
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
		if (e instanceof NpbNotFoundError) return error(404, e.message)
		if (e instanceof Error && e.name === 'TimeoutError') {
			return error(504, 'npb.jp did not respond in time.')
		}

		return error(502, `Could not load the NPB schedule (${e instanceof Error ? e.message : e}).`)
	}
}
