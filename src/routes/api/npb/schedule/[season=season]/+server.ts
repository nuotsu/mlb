import { cacheControlForSeasonPage } from '#lib/cache-control.js'
import { filterNpbSchedule } from '#lib/npb-schedule.js'
import { getNpbSchedule, NpbNotFoundError } from '#lib/server/npb.js'
import type { RequestHandler } from './$types'

function error(status: number, message: string) {
	return Response.json(
		{ message },
		{ status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
	)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * NPB's regular season schedule for a season, parsed from npb.jp, optionally narrowed to
 * `?startDate=&endDate=` (`YYYY-MM-DD`, inclusive) and/or one `?teamId=` (Stats API team ID).
 * Cached at the CDN, and in memory per season (see `getNpbSchedule`).
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const season = Number(params.season)
	const startDate = url.searchParams.get('startDate') ?? undefined
	const endDate = url.searchParams.get('endDate') ?? undefined
	const teamId = url.searchParams.get('teamId') ?? undefined

	if (
		(startDate && !ISO_DATE.test(startDate)) ||
		(endDate && !ISO_DATE.test(endDate)) ||
		(teamId && !/^\d+$/.test(teamId))
	) {
		return error(400, 'startDate and endDate take YYYY-MM-DD, and teamId a number.')
	}

	try {
		const schedule = await getNpbSchedule(season)

		return Response.json(
			{
				season,
				source: 'https://npb.jp/games/',
				allStarDates: schedule.allStarDates,
				games: filterNpbSchedule(schedule.games, {
					startDate,
					endDate,
					teamId: teamId ? Number(teamId) : undefined,
				}),
			},
			{
				headers: {
					'Cache-Control': cacheControlForSeasonPage(season),
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
