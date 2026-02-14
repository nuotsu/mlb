import { fetchDaySchedule, fetchSeason } from '$lib/fetch'
import { getToday, slash } from '$lib/temporal'
import { fetchSeasonProgress } from './fetch-season-progress'

export const load = async ({ params, url }) => {
	const sportId = url.searchParams.get('sportId') || '1'
	const year = (new Date(slash(params.date)).getFullYear() ?? getToday().getFullYear()).toString()

	const [schedule, season] = await Promise.all([
		fetchDaySchedule(params.date, sportId),
		fetchSeason(year),
	])

	const seasonProgress = await fetchSeasonProgress(sportId, year, schedule)

	return {
		schedule,
		seasonProgress,
		season,
	}
}
