import { fetchMLB } from '#lib/fetch/index.js'
import type { Actions } from './$types'

export const actions = {
	default: async ({ request, url, fetch }) => {
		const formData = await request.formData()
		const personIds = formData.get('ids') as string

		const allStats = formData.getAll('stats').join(',')
		const type = formData.get('type') as string

		const statsHydration = [
			`group=[${formData.get('group')}]`,
			`type=[${type}]`,
			['season,seasonAdvanced', 'projected'].includes(type) && `season=${formData.get('season')}`,
			['byDateRange'].includes(type) &&
				`startDate=${formData.get('startDate')},endDate=${formData.get('endDate')}`,
			['vsTeam'].includes(type) &&
				formData.get('opposingTeamId') &&
				`opposingTeamId=${formData.get('opposingTeamId')}`,
		]
			.filter(Boolean)
			.join(',')

		const results = await fetchMLB<MLB.PersonResponse>(
			'/api/v1/people',
			{
				personIds,
				fields: ['people,id,fullName', 'stats,group,displayName,splits,season,stat', allStats],
				hydrate: `stats(${statsHydration})`,
			},
			{ fetch },
		)

		return {
			entries: {
				...Object.fromEntries(formData.entries()),
				group: formData.get('group') as string,
				stats: allStats,
			},
			results,
		}
	},
} satisfies Actions
