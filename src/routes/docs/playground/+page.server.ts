import type { Actions } from './$types'
import { HOST } from './constants'

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData()

		let endpoint = (formData.get('endpoint') as string) || ''

		for (const [key, value] of formData.entries()) {
			if (key !== 'endpoint') {
				endpoint = endpoint.replace(`{${key}}`, value as string)
			}
		}

		const results = await fetch(`${HOST}${endpoint}`)
		const result = await results.json()

		return {
			endpoint,
			result,
		}
	},
} satisfies Actions
