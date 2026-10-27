import { fetchMLB } from '#lib/fetch/index.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ fetch }) => {
	const personIds = [660271, 592450, 669373, 691718, 694819, 300001, 580268, 121578, 121314]

	const players = await fetchMLB<MLB.PersonResponse>(
		`/api/v1/people`,
		{
			personIds: personIds.join(','),
			fields: ['people,id,lastName'],
		},
		{ fetch },
	)

	return {
		players,
	}
}
