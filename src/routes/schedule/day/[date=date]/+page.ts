import { fetchDaySchedule, fetchSeason } from '$lib/fetch/presets'
import { fetchMLB } from '$lib/fetch'
import { cacheControlForScheduleDay } from '$lib/cache-control'
import { getToday, slash } from '$lib/temporal'
import { fetchSeasonProgress } from './fetch-season-progress'

export const load = async ({ params, url, depends, setHeaders }) => {
	depends('schedule:day')
	setHeaders({ 'cache-control': cacheControlForScheduleDay(params.date) })

	const sportId = url.searchParams.get('sportId') || '1'
	const year = (new Date(slash(params.date)).getFullYear() ?? getToday().getFullYear()).toString()

	const [schedule, season, { leagues }] = await Promise.all([
		fetchDaySchedule(params.date, sportId),
		fetchSeason(year),
		fetchMLB<MLB.LeaguesResponse>(
			'/api/v1/leagues',
			{ season: year, fields: 'leagues,id,sport,id' },
		),
	])

	const availableSportIds = [...new Set(leagues.map((l) => l.sport?.id).filter(Boolean))] as number[]
	const seasonProgress = await fetchSeasonProgress(sportId, year, schedule)

	return {
		schedule,
		seasonProgress,
		season,
		availableSportIds,
	}
}
