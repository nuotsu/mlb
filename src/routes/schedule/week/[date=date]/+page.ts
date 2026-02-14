import { fetchSeason, fetchWeekSchedule } from '$lib/fetch'
import { slash } from '$lib/temporal.js'

export const load = async ({ params, url }) => {
	const sportId = url.searchParams.get('sportId') || '1'
	const year = new Date(slash(params.date)).getFullYear().toString()

	const [schedule, season] = await Promise.all([
		fetchWeekSchedule(params.date, sportId),
		fetchSeason(year),
	])

	return {
		schedule,
		season,
	}
}
