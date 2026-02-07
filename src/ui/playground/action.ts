import { dev } from '$app/environment'
import { getPostHogClient } from '$lib/server/posthog'
import { HOST } from '$ui/playground/constants'

export async function playgroundAction({ request }: { request: Request }) {
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

	for (const [key, value] of Array.from(fetchUrl.searchParams.entries())) {
		if (value === '') {
			fetchUrl.searchParams.delete(key)
		}
	}

	const results = await fetch(fetchUrl)
	const result = await results.json()

	if (!dev) {
		getPostHogClient().capture({
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
}
