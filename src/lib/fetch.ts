import { HOST, PRESETS } from '$ui/playground/constants'

type QueryParamKeys = keyof typeof PRESETS | 'startDate' | 'endDate' | 'fields' | 'hydrate'

export async function fetchMLB<T>(
	endpoint: string,
	params?: Partial<Record<QueryParamKeys, string>>,
) {
	const url = new URL(endpoint, HOST)

	for (const [key, value] of Object.entries(params ?? {})) {
		url.searchParams.set(key, value)
	}

	const response = await fetch(url.toString())

	return (await response.json()) as T
}
