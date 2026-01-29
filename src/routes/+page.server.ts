import { fetchMLB } from '$lib/fetch'
import { getToday } from '$lib/temporal'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
	const year = getToday().getFullYear().toString()

	const seasons = await fetchMLB<MLB.SeasonResponse>(`/api/v1/seasons`, {
		sportId: '1',
		season: year,
	})

	const [season] = seasons.seasons

	return {
		season,
	}
}
