import { CUSTOM_ENDPOINT_KEY, ENDPOINTS } from '#ui/playground/constants.js'

/**
 * The directory entry for a concrete path, with its path params. Falls back to the other API
 * version (v1 ↔ v1.1) so e.g. /api/v1/game/849812/feed/live opens the v1.1 live feed.
 */
export function matchEndpoint(urlPath: string) {
	return (
		matchExact(urlPath) ??
		matchExact(urlPath.replace(/^\/api\/v1(\.1)?\//, (_, dot) => (dot ? '/api/v1/' : '/api/v1.1/')))
	)
}

function matchExact(urlPath: string) {
	let parameterizedMatch: { key: string; pathParams: Record<string, string> } | null = null

	for (const key of Object.keys(ENDPOINTS)) {
		if (key === CUSTOM_ENDPOINT_KEY || !key.startsWith('/api/')) continue

		const keySegments = key.split('/')
		const urlSegments = urlPath.split('/')

		if (keySegments.length !== urlSegments.length) continue

		const pathParams: Record<string, string> = {}
		let match = true
		let hasParams = false

		for (let i = 0; i < keySegments.length; i++) {
			const paramMatch = keySegments[i].match(/^\{(.+)\}$/)
			if (paramMatch) {
				pathParams[paramMatch[1]] = urlSegments[i]
				hasParams = true
			} else if (keySegments[i] !== urlSegments[i]) {
				match = false
				break
			}
		}

		if (match) {
			if (!hasParams) return { key, pathParams }
			if (!parameterizedMatch) parameterizedMatch = { key, pathParams }
		}
	}

	return parameterizedMatch
}

export function endpointToUrl(endpointKey: string) {
	if (endpointKey === CUSTOM_ENDPOINT_KEY) return '/api/v1'

	const config = ENDPOINTS[endpointKey]
	let url = endpointKey

	if (config?.pathParams) {
		for (const [param, values] of Object.entries(config.pathParams)) {
			url = url.replace(`{${param}}`, values[0]?.value ?? '')
		}
	}

	return url
}
