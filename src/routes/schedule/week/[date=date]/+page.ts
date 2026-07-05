import { fetchSeason, fetchWeekSchedule } from '$lib/fetch/presets'
import { fetchMLB } from '$lib/fetch'
import { cacheControlForScheduleWeek } from '$lib/cache-control'
import { slash } from '$lib/temporal.js'
import { error } from '@sveltejs/kit'

// A 500 here invites crawler retries; dates MLB has no data for are a 404, not a server error.
function notFoundOnMissingData(e: unknown): never {
	if (e instanceof Error && e.message.startsWith('MLB API 404')) error(404, 'No MLB data for this date')
	throw e
}

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
	]).catch(notFoundOnMissingData)

	const availableSportIds = [...new Set(leagues.map((l) => l.sport?.id).filter(Boolean))] as number[]

	return {
		schedule,
		season,
		availableSportIds,
	}
}
