import { HOST } from '$ui/playground/constants'
import type { Actions } from './$types'

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData()
		const endpoint = (formData.get('endpoint') as string) || ''
		const endpointWithParameters = (formData.get('endpoint-with-parameters') as string) || ''

		let processedUrl = HOST + endpointWithParameters

		for (const [key, value] of formData.entries()) {
			if (key !== 'endpoint') {
				processedUrl = processedUrl.replace(`{${key}}`, value as string)
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
			endpoint,
			endpointWithParameters,
			fetchUrl: decodeURIComponent(fetchUrl.toString()),
			result,
		}
	},
} satisfies Actions
