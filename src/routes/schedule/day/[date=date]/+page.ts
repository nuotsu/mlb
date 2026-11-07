import { error } from '@sveltejs/kit'
import { cacheControlForScheduleDay } from '#lib/cache-control.js'
import { fetchMLB, notFoundOnMlb404 } from '#lib/fetch/index.js'
import { fetchDaySchedule, fetchSeason } from '#lib/fetch/presets.js'
import { loadNpbSchedule, scheduleSportIds } from '#lib/npb-schedule.js'
import { NPB_SPORT_ID } from '#lib/npb.js'
import { getToday, slash } from '#lib/temporal.js'
import { fetchSeasonProgress } from './fetch-season-progress'

// A 500 here invites crawler retries; dates MLB has no data for are a 404, not a server error.
const notFoundOnMissingData = (e: unknown): never =>
	notFoundOnMlb404(e, 'No MLB data for this date')

export const load = async ({ params, url, depends, fetch, setHeaders }) => {
	depends('schedule:day')

	const sportId = url.searchParams.get('sportId') || '1'
	const year = (new Date(slash(params.date)).getFullYear() ?? getToday().getFullYear()).toString()

	/** NPB isn't in the Stats API's schedule; it comes from npb.jp through our own route */
	if (sportId === String(NPB_SPORT_ID)) {
		const [npb, { leagues }] = await Promise.all([
			loadNpbSchedule(
				year,
				{ startDate: params.date, endDate: params.date, linescores: true },
				fetch,
			),
			fetchMLB<MLB.LeaguesResponse>('/api/v1/leagues', {
				season: year,
				fields: 'leagues,id,sport,id',
			}),
		]).catch(() => error(502, 'Could not load the NPB schedule.'))

		// Only once it loads, so a failed upstream fetch is never CDN-cached
		setHeaders({ 'cache-control': cacheControlForScheduleDay(params.date) })

		return {
			schedule: { dates: [] } as unknown as MLB.ScheduleResponse,
			seasonProgress: null,
			season: null as unknown as MLB.SeasonDateInfo,
			availableSportIds: scheduleSportIds(leagues, year),
			seriesContext: null,
			npb: npb.games,
		}
	}

	setHeaders({ 'cache-control': cacheControlForScheduleDay(params.date) })

	const seriesStartDate = new Date(slash(params.date))
	seriesStartDate.setDate(seriesStartDate.getDate() - 7)
	const seriesStartDateStr = seriesStartDate.toISOString().split('T')[0]

	const [schedule, season, { leagues }, seriesContext] = await Promise.all([
		fetchDaySchedule(params.date, sportId),
		fetchSeason(year),
		fetchMLB<MLB.LeaguesResponse>('/api/v1/leagues', {
			season: year,
			fields: 'leagues,id,sport,id',
		}),
		fetchMLB<MLB.ScheduleResponse>(
			'/api/v1/schedule',
			{
				sportId,
				startDate: seriesStartDateStr,
				endDate: params.date,
				fields: [
					'dates,games,gamesInSeries',
					'status,abstractGameState',
					'teams,home,away,team,id,score',
				],
			},
			{ fetch },
		),
	]).catch(notFoundOnMissingData)

	const seasonProgress = await fetchSeasonProgress(sportId, year, schedule)

	return {
		schedule,
		seasonProgress,
		season,
		availableSportIds: scheduleSportIds(leagues, year),
		seriesContext,
		npb: null,
	}
}
