import { fetchMLB } from '$lib/fetch'
import { getToday } from '$lib/temporal'
import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
	const season = await fetchMLB<MLB.SeasonResponse>(`/api/v1/seasons`, {
		sportId: '1',
		season: getToday().getFullYear().toString(),
	})

	return {
		season,
	}
}
