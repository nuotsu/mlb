import { fetchDaySchedule } from '../fetch'

export const load = async ({ params, url }) => {
	const sportId = url.searchParams.get('sportId') || '1'

	const schedule = await fetchDaySchedule(params.date, sportId)

	return {
		schedule,
	}
}
