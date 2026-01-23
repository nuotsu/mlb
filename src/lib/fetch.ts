import { HOST, PRESETS } from '$ui/playground/constants'

type QueryParamKeys = keyof typeof PRESETS | 'startDate' | 'endDate' | 'fields' | 'hydrate' | 'names'

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

// presets

export async function fetchfeedLive(gamePk: string | number) {
	return await fetchMLB<MLB.LiveGameFeed>(`/api/v1.1/game/${gamePk}/feed/live`, {
		fields: [
			'gamePk,gameData,liveData',
			'players,fullName,lastName',
			'gameInfo,attendance,gameDurationMinutes',
			'weather,condition,temp,wind',
			'teams,home,away',
			'linescore,currentInning,scheduledInnings,innings,num,runs,hits,errors,leftOnBase',
			'boxscore,topPerformers,type,player,boxscoreName,stats,batting,pitching,summary',
			'decisions,winner,loser,save,id',
		],
	})
}

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
