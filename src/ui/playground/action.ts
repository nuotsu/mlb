import { redirect } from '@sveltejs/kit'
import { CUSTOM_ENDPOINT_KEY, ENDPOINTS } from '#ui/playground/constants.js'
import { initialValues, resolveRequest } from '#ui/playground/request.js'
import { endpointToUrl } from '#ui/playground/utils.js'

/**
 * No-JS fallback for the playground form (with JS the form is handled client-side).
 * Switching endpoints reloads the playground for that endpoint; otherwise the browser is sent to
 * the proxy, which shows the raw JSON and records the `playground_form_submitted` event.
 */
export async function playgroundAction({ request }: { request: Request }) {
	const formData = await request.formData()
	const selected = String(formData.get('endpoint-path') ?? CUSTOM_ENDPOINT_KEY)
	const endpointKey = selected in ENDPOINTS ? selected : CUSTOM_ENDPOINT_KEY
	const rendered = formData.get('rendered-endpoint')

	if (rendered !== null && rendered !== endpointKey) {
		redirect(303, endpointToUrl(endpointKey))
	}

	const submitted: Record<string, string> = {}

	for (const [key, value] of formData) {
		if (typeof value === 'string') submitted[key] = value
	}

	const resolved = resolveRequest(endpointKey, initialValues(endpointKey, submitted))

	if (!resolved.valid) redirect(303, endpointToUrl(endpointKey))

	redirect(303, resolved.proxyUrl)
}
