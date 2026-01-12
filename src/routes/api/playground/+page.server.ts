import { HOST } from '$ui/playground/constants'
import type { Actions } from './$types'

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData()
		const endpoint = (formData.get('endpoint') as string) || ''
		const endpointWithParameters = (formData.get('endpoint-with-parameters') as string) || ''

		let processedUrl = HOST + endpointWithParameters

		// for v1.x
		const custom = formData.get('custom') as string
		if (custom) {
			const { version } = /^\/api\/v(?<version>[0-9.]+)\//g.exec(custom)?.groups ?? {}
			if (version !== '1') {
				processedUrl = processedUrl.replace('/api/v1/', '')
			}
		}

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
