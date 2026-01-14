import { dev } from '$app/environment'
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from '$env/static/public'
import { HOST } from '$ui/playground/constants'
import { PostHog } from 'posthog-node'
import type { Actions } from './$types'

const posthog = new PostHog(PUBLIC_POSTHOG_KEY, {
	host: PUBLIC_POSTHOG_HOST,
})

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

		if (!dev) {
			posthog.capture({
				event: 'playground_form_submitted',
				distinctId: formData.get('distinctId') as string,
				properties: {
					fetchUrl: fetchUrl.toString(),
				},
			})
		}

		return {
			entries: Object.fromEntries(formData.entries()),
			endpointPath,
			endpoint,
			fetchUrl: decodeURIComponent(fetchUrl.toString()),
			truncated: true,
			result,
		}
	},
} satisfies Actions
