import { HOST } from '$ui/playground/constants'
import type { Actions } from './$types'

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData()
		const endpointPath = formData.get('endpoint-path') as string
		const endpoint = decodeURIComponent(formData.get('endpoint') as string) || ''

		let processedUrl = HOST + endpoint

		for (const [key, value] of formData.entries()) {
			if (key !== 'endpoint') {
				const newValue = key === 'custom' ? value.toString().replace(/^\//, '') : (value as string)
				processedUrl = processedUrl.replace(`{${key}}`, newValue)
			}
		}

		const fetchUrl = new URL(processedUrl)

		fetchUrl.searchParams.forEach((value, key) => {
			if (!value) {
				fetchUrl.searchParams.delete(key)
			}
		})

		const results = await fetch(fetchUrl)
		const result = await results.json()

		return {
			entries: Object.fromEntries(formData.entries()),
			endpointPath,
			endpoint,
			fetchUrl: decodeURIComponent(fetchUrl.toString()),
			result,
		}
	},
} satisfies Actions
