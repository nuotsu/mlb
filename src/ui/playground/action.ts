import { getPostHogClient } from '#lib/server/posthog.js'
import { HOST } from '#ui/playground/constants.js'
import { dev } from '$app/env'

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

	let result: unknown
	try {
		const results = await fetch(fetchUrl, { signal: AbortSignal.timeout(10_000) })
		if (!results.ok) throw new Error(`${results.status}`)
		result = await results.json()
	} catch (e) {
		result = { error: e instanceof Error ? e.message : String(e) }
	}

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
