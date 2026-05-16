import { fetchSeason, fetchWeekSchedule } from '$lib/fetch/presets'
import { fetchMLB } from '$lib/fetch'
import { cacheControlForScheduleWeek } from '$lib/server/traffic'
import { slash } from '$lib/temporal.js'

export const load = async ({ params, url, depends, fetch, setHeaders }) => {
	depends('schedule:week')
	setHeaders({ 'cache-control': cacheControlForScheduleWeek(params.date) })

	const sportId = url.searchParams.get('sportId') || '1'
	const year = new Date(slash(params.date)).getFullYear().toString()

	const [schedule, season, { leagues }] = await Promise.all([
		fetchWeekSchedule(params.date, sportId),
		fetchSeason(year),
		fetchMLB<MLB.LeaguesResponse>(
			'/api/v1/leagues',
			{ season: year, fields: 'leagues,id,sport,id' },
			{ fetch },
		),
	])

	const availableSportIds = [...new Set(leagues.map((l) => l.sport?.id).filter(Boolean))] as number[]

	return {
		schedule,
		season,
		availableSportIds,
	}
}
