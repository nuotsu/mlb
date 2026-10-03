import { fetchMLB } from '#lib/fetch/index.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch }) => {
	const personIds = [660271, 592450, 669373, 694973, 300001, 121578, 121314].join(',')

	const players = await fetchMLB<MLB.PersonResponse>(
		`/api/v1/people`,
		{
			personIds,
			fields: ['people,id,lastName'],
		},
		{ fetch },
	)

	return {
		players,
	}
}
