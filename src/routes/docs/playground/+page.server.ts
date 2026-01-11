import type { Actions } from './$types'
import { HOST } from './constants'

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData()
		const endpoint = (formData.get('endpoint') as string) || ''

		let processedUrl = HOST + endpoint

		for (const [key, value] of formData.entries()) {
			if (key !== 'endpoint') {
				processedUrl = processedUrl.replace(`{${key}}`, value as string)
			}
		}

		const fetchUrl = new URL(processedUrl)

		fetchUrl.searchParams.forEach((value, key) => {
			if (!value) fetchUrl.searchParams.delete(key)
		})

		const results = await fetch(fetchUrl.toString())
		const result = await results.json()

		return {
			entries: Object.fromEntries(formData.entries()),
			endpoint,
			fetchUrl,
			result,
		}
	},
} satisfies Actions
