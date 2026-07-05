import { fetchDaySchedule, fetchSeason } from '$lib/fetch/presets'
import { fetchMLB } from '$lib/fetch'
import { cacheControlForScheduleDay } from '$lib/cache-control'
import { getToday, slash } from '$lib/temporal'
import { error } from '@sveltejs/kit'
import { fetchSeasonProgress } from './fetch-season-progress'

// A 500 here invites crawler retries; dates MLB has no data for are a 404, not a server error.
function notFoundOnMissingData(e: unknown): never {
	if (e instanceof Error && e.message.startsWith('MLB API 404')) error(404, 'No MLB data for this date')
	throw e
}

export const load = async ({ params, url, depends, fetch, setHeaders }) => {
	depends('schedule:day')
	setHeaders({ 'cache-control': cacheControlForScheduleDay(params.date) })

	const sportId = url.searchParams.get('sportId') || '1'
	const year = (new Date(slash(params.date)).getFullYear() ?? getToday().getFullYear()).toString()

	const seriesStartDate = new Date(slash(params.date))
	seriesStartDate.setDate(seriesStartDate.getDate() - 7)
	const seriesStartDateStr = seriesStartDate.toISOString().split('T')[0]

	const [schedule, season, { leagues }, seriesContext] = await Promise.all([
		fetchDaySchedule(params.date, sportId),
		fetchSeason(year),
		fetchMLB<MLB.LeaguesResponse>(
			'/api/v1/leagues',
			{ season: year, fields: 'leagues,id,sport,id' },
		),
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

	const availableSportIds = [...new Set(leagues.map((l) => l.sport?.id).filter(Boolean))] as number[]
	const seasonProgress = await fetchSeasonProgress(sportId, year, schedule)

	return {
		schedule,
		seasonProgress,
		season,
		availableSportIds,
		seriesContext,
	}
}
