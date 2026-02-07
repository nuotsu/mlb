import { fetchDaySchedule } from '$lib/fetch'
import { getToday, slash } from '$lib/temporal'
import { fetchSeasonProgress } from './fetch-season-progress'

export const load = async ({ params, url }) => {
	const sportId = url.searchParams.get('sportId') || '1'
	const year = (new Date(slash(params.date)).getFullYear() ?? getToday().getFullYear()).toString()

	const schedule = await fetchDaySchedule(params.date, sportId)
	const seasonProgress = await fetchSeasonProgress(sportId, year, schedule)

	return {
		schedule,
		seasonProgress,
	}
}
