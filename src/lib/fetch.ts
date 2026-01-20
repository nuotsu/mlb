import { HOST, PRESETS } from '$ui/playground/constants'

type QueryParamKeys = keyof typeof PRESETS | 'startDate' | 'endDate' | 'fields' | 'hydrate'

export async function fetchMLB<T>(
	endpoint: string,
	params?: Partial<Record<QueryParamKeys, string | string[]>>,
) {
	const url = new URL(endpoint, HOST)

	for (const [key, value] of Object.entries(params ?? {})) {
		url.searchParams.set(key, typeof value !== 'string' ? value.flat().join(',') : value)
	}

	const response = await fetch(url.toString())

	return (await response.json()) as T
}

// game

export async function fetchBoxscore(gamePk: string | number) {
	return await fetchMLB<MLB.Boxscore>(`/api/v1/game/${gamePk}/boxscore`, {
		fields: 'teams,away,team,id,name,teamName,abbreviation,sport',
	})
}

export async function fetchLinescore(gamePk: string | number) {
	return await fetchMLB<MLB.Linescore>(`/api/v1/game/${gamePk}/linescore`, {
		fields: [
			'currentInning,scheduledInnings',
			'innings,num,runs,hits,errors,leftOnBase',
			'teams,home,away',
		],
	})
}
