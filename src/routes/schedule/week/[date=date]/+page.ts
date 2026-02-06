import { fetchWeekSchedule } from '$lib/fetch'

export const load = async ({ params, url }) => {
	const sportId = url.searchParams.get('sportId') || '1'

	const schedule = await fetchWeekSchedule(params.date, sportId)

	return {
		schedule,
	}
}
