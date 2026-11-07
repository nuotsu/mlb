import { error } from '@sveltejs/kit'
import { cacheControlForScheduleWeek } from '#lib/cache-control.js'
import { fetchMLB, notFoundOnMlb404 } from '#lib/fetch/index.js'
import { fetchSeason, fetchWeekSchedule } from '#lib/fetch/presets.js'
import { loadNpbSchedule, scheduleSportIds } from '#lib/npb-schedule.js'
import { NPB_SPORT_ID } from '#lib/npb.js'
import { slash } from '#lib/temporal.js'
import { getWeekDates } from '#ui/schedule/store.svelte.js'

// A 500 here invites crawler retries; dates MLB has no data for are a 404, not a server error.
const notFoundOnMissingData = (e: unknown): never =>
	notFoundOnMlb404(e, 'No MLB data for this date')

export const load = async ({ params, url, depends, fetch, setHeaders }) => {
	depends('schedule:week')

	const sportId = url.searchParams.get('sportId') || '1'
	const year = new Date(slash(params.date)).getFullYear().toString()

	/** NPB isn't in the Stats API's schedule; it comes from npb.jp through our own route */
	if (sportId === String(NPB_SPORT_ID)) {
		const { startDate, endDate } = getWeekDates(params.date)
		// A week can span New Year's, though NPB plays no games then
		const seasons = [...new Set([startDate, endDate].map((date) => date.slice(0, 4)))]

		const [npb, { leagues }] = await Promise.all([
			Promise.all(
				seasons.map((season) =>
					loadNpbSchedule(season, { startDate, endDate, linescores: true }, fetch),
				),
			),
			fetchMLB<MLB.LeaguesResponse>(
				'/api/v1/leagues',
				{ season: year, fields: 'leagues,id,sport,id' },
				{ fetch },
			),
		]).catch(() => error(502, 'Could not load the NPB schedule.'))

		// Only once it loads, so a failed upstream fetch is never CDN-cached
		setHeaders({ 'cache-control': cacheControlForScheduleWeek(params.date) })

		return {
			schedule: { dates: [] } as unknown as MLB.ScheduleResponse,
			season: null as unknown as MLB.SeasonDateInfo,
			availableSportIds: scheduleSportIds(leagues, year),
			npb: npb.flatMap(({ games }) => games),
		}
	}

	setHeaders({ 'cache-control': cacheControlForScheduleWeek(params.date) })

	const [schedule, season, { leagues }] = await Promise.all([
		fetchWeekSchedule(params.date, sportId),
		fetchSeason(year),
		fetchMLB<MLB.LeaguesResponse>(
			'/api/v1/leagues',
			{ season: year, fields: 'leagues,id,sport,id' },
			{ fetch },
		),
	]).catch(notFoundOnMissingData)

	return {
		schedule,
		season,
		availableSportIds: scheduleSportIds(leagues, year),
		npb: null,
	}
}
