import { HOST, PRESETS } from '$ui/playground/constants'
import { getWeekDates } from '$ui/schedule/store.svelte'
import { formatDate } from './temporal'

type QueryParamKeys =
	| keyof typeof PRESETS
	| 'startDate'
	| 'endDate'
	| 'fields'
	| 'hydrate'
	| 'names'
	| (string & {})

type Params = Partial<Record<QueryParamKeys, string | string[]>>

export async function fetchMLB<T>(
	endpoint: string,
	params?: Partial<Record<QueryParamKeys, string | string[]>>,
) {
	const url = new URL(endpoint, HOST)

	for (const [key, value] of Object.entries(params ?? {})) {
		url.searchParams.set(key, typeof value !== 'string' ? value!.flat().join(',') : value)
	}

	const response = await fetch(url.toString())

	return (await response.json()) as T
}

// presets

export async function fetchWeekSchedule(date: string, sportId = '1') {
	const { startDate, endDate } = getWeekDates(date)

	return fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
		sportId,
		startDate: formatDate(startDate, {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}),
		endDate: formatDate(endDate, {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}),
		fields: [
			'dates,date,venue,description,seriesGameNumber,gamesInSeries',
			'games,gamePk,gameType,gameDate',
			'status,abstractGameState,detailedState,reason',
			'probablePitchers',
			'flags,noHitter,perfectGame',
			'teams,away,home,team,id,name,leagueRecord,wins,losses,score',
			'linescore,currentInning,scheduledInnings',
			'innings,num,runs,hits,errors,leftOnBase',
		],
		hydrate: 'flags,linescore',
	})
}

export async function fetchDaySchedule(date: string, sportId = '1') {
	return fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
		sportId,
		date,
		fields: [
			'totalGames,dates,date,venue,description,seriesGameNumber,gamesInSeries',
			'games,gamePk,gameType,gameDate',
			'status,abstractGameState,detailedState,reason',
			'flags,noHitter,perfectGame',
			'teams,away,home,team,id,name,leagueRecord,wins,losses,score',
			'linescore,currentInning,scheduledInnings',
			'innings,num,runs,hits,errors,leftOnBase',
		],
		hydrate: 'teams,flags,linescore',
	})
}

export async function fetchfeedLive(gamePk: string | number) {
	return await fetchMLB<MLB.LiveGameFeed>(`/api/v1.1/game/${gamePk}/feed/live`, {
		fields: [
			'gamePk,gameData,liveData',
			'players,fullName,lastName',
			'gameInfo,attendance,gameDurationMinutes',
			'weather,condition,temp,wind',
			'teams,home,away',
			'linescore,currentInning,scheduledInnings,innings,num,runs,hits,errors,leftOnBase',
			'boxscore,position,abbreviation,topPerformers,type,player,boxscoreName,stats,batting,pitching,summary',
			'decisions,winner,loser,save,id',
		],
	})
}

export async function fetchBoxscore(gamePk: string | number, params: Params = {}) {
	return await fetchMLB<MLB.Boxscore>(`/api/v1/game/${gamePk}/boxscore`, {
		...params,
		fields: [
			'teams,away,team,id,name,teamName,clubName,abbreviation,sport',
			...(params?.fields ?? []),
		],
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

export async function fetchWeekTransactions({
	date,
	startDate,
	endDate,
	...params
}: {
	date?: string
	startDate?: string
	endDate?: string
} & Params) {
	const weekStartDate = date ? getWeekDates(date).startDate : startDate
	const weekEndDate = date ? getWeekDates(date).endDate : endDate

	return await fetchMLB<MLB.TransactionsResponse>('/api/v1/transactions', {
		sportId: '1',
		startDate: formatDate(weekStartDate!, { locale: 'en-CA' }),
		endDate: formatDate(weekEndDate!, { locale: 'en-CA' }),
		fields: ['transactions,date,description,typeDesc,toTeam,fromTeam,id,name,person'],
		...params,
	})
}
