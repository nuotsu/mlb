import { CUSTOM_ENDPOINT_KEY } from '#ui/playground/constants.js'
import { matchEndpoint } from '#ui/playground/utils.js'

export const load = async ({ params, url }) => {
	const { version, path } = params
	const fullPath = `/api/${version}${path ? `/${path}` : ''}`
	const match = matchEndpoint(fullPath)
	// A deep link (e.g. /api/v1/game/849812/feed/live) runs as soon as the page opens
	const autoRun = Boolean(path)

	if (match) {
		const queryParams: Record<string, string> = {}

		for (const [key, value] of url.searchParams) {
			queryParams[key] = value
		}

		return {
			endpointKey: match.key,
			initialParams: { ...match.pathParams, ...queryParams },
			autoRun,
		}
	}

	const queryString = url.searchParams.toString()
	const customPath = queryString ? `${fullPath}?${queryString}` : fullPath

	return {
		endpointKey: CUSTOM_ENDPOINT_KEY,
		initialParams: { custom: customPath },
		autoRun,
	}
}
