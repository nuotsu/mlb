import type { Actions } from './$types'
import { HOST } from './constants'

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData()
		const endpoint = (formData.get('endpoint') as string) || ''

		let fetchUrl = endpoint

		for (const [key, value] of formData.entries()) {
			if (key !== 'endpoint') {
				fetchUrl = fetchUrl.replace(`{${key}}`, value as string)
			}
		}

		const results = await fetch(HOST + fetchUrl)
		const result = await results.json()

		return {
			entries: Object.fromEntries(formData.entries()),
			endpoint,
			fetchUrl,
			result,
		}
	},
} satisfies Actions
