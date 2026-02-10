import { CUSTOM_ENDPOINT_KEY } from '$ui/playground/constants'
import { matchEndpoint } from '$ui/playground/utils'

export const load = async ({ params, url }) => {
	const { version, path } = params
	const fullPath = `/api/${version}${path ? `/${path}` : ''}`
	const match = matchEndpoint(fullPath)

	if (match) {
		const queryParams: Record<string, string> = {}

		for (const [key, value] of url.searchParams) {
			queryParams[key] = value
		}

		return {
			endpointKey: match.key,
			initialParams: { ...match.pathParams, ...queryParams },
		}
	}

	const queryString = url.searchParams.toString()
	const customPath = queryString ? `${fullPath}?${queryString}` : fullPath

	return {
		endpointKey: CUSTOM_ENDPOINT_KEY,
		initialParams: { custom: customPath },
	}
}
