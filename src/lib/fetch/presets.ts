import { formatDate } from '$lib/temporal'
import { getWeekDates } from '$ui/schedule/store.svelte'
import { createPreset as createFetcher, fetchMLB } from '.'

export async function fetchSeason(year: string, sportId = '1') {
	const seasons = await fetchMLB<MLB.SeasonResponse>(`/api/v1/seasons`, {
		sportId,
		season: year,
	})

	return seasons?.seasons?.[0]
}

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

export const fetchfeedLive = createFetcher<[gamePk: string | number], MLB.LiveGameFeed>(
	(gamePk) => ({
		endpoint: `/api/v1.1/game/${gamePk}/feed/live`,
		params: {
			fields: [
				'gamePk,gameData,liveData',
				'players,id,fullName,lastName,boxscoreName,pitchHand,code',
				'gameInfo,firstPitch,attendance,gameDurationMinutes',
				'weather,condition,temp,wind',
				'teams,home,away,id,name,abbreviation,teamName',
				'absChallenges,hasChallenges,usedSuccessful,usedFailed,remaining',
				'linescore,currentInning,scheduledInnings,innings,num,runs,hits,errors,leftOnBase',
				'boxscore,position,abbreviation,topPerformers,type,player,boxscoreName,stats,batting,pitching,summary',
				'decisions,winner,loser,save,id',
				'plays,allPlays,result,description,event,eventType,rbi,about,inning,isTopInning,atBatIndex,isScoringPlay,hasOut,hasReview,runnerIndex,count,balls,strikes,outs,awayScore,homeScore,matchup,batter,pitcher,batSide,pitchHand,code,id,fullName,lastName,boxscoreName,playEvents,isPitch,details,isBall,isStrike,isInPlay,call,reviewDetails,isOverturned,inProgress,challengeTeamId,reviewType,player,hitData,launchSpeed,launchAngle,totalDistance,trajectory,coordinates,coordX,coordY,pitchData,startSpeed,strikeZoneTop,strikeZoneBottom,pX,pZ,pfxX,pfxZ,x0,y0,z0,vX0,vY0,vZ0,aX,aY,aZ,type',
			],
		},
	}),
)

export const fetchBoxscore = createFetcher<
	[gamePk: string | number, params?: Fetch.Params],
	MLB.Boxscore
>((gamePk, params = {}) => ({
	endpoint: `/api/v1/game/${gamePk}/boxscore`,
	params: {
		fields: [
			'teams,away,team,id,name,teamName,clubName,abbreviation,sport',
			'boxscoreName',
			'stats,batting,atBats,hits,runs,rbi,stolenBases,homeRuns,baseOnBalls,strikeOuts,avg,ops',
			'pitching,inningsPitched,numberOfPitches,earnedRuns,hitBatsmen,era',
		],
		...params,
	},
}))

export const fetchLinescore = createFetcher<[gamePk: string | number], MLB.Linescore>((gamePk) => ({
	endpoint: `/api/v1/game/${gamePk}/linescore`,
	params: {
		fields: [
			'currentInning,scheduledInnings',
			'innings,num,runs,hits,errors,leftOnBase',
			'teams,away,home',
		],
	},
}))

export const fetchWinProbability = createFetcher<
	[gamePk: string | number],
	MLB.PlayWinProbability[]
>((gamePk) => ({
	endpoint: `/api/v1/game/${gamePk}/winProbability`,
	params: {
		fields:
			'result,about,inning,isTopInning,isScoringPlay,atBatIndex,halfInning,homeTeamWinProbability,awayTeamWinProbability,homeTeamWinProbabilityAdded',
	},
}))

export async function fetchPitchingGameLogs(
	personIds: (string | number)[],
	season: string | number,
) {
	if (!personIds.length) return { people: [] } as MLB.PersonResponse

	return fetchMLB<MLB.PersonResponse>('/api/v1/people', {
		personIds: personIds.map(String),
		hydrate: `stats(group=[pitching],type=[gameLog],season=${season})`,
		fields: [
			'people,id,lastName,lastInitName,pitchHand,code',
			'stats,type,displayName,group,splits,date,stat,numberOfPitches,inningsPitched,gamesStarted',
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
} & Fetch.Params) {
	const weekStartDate = date ? getWeekDates(date).startDate : startDate
	const weekEndDate = date ? getWeekDates(date).endDate : endDate

	return await fetchMLB<MLB.TransactionsResponse>('/api/v1/transactions', {
		sportId: '1',
		startDate: formatDate(weekStartDate!, { locale: 'en-CA' }),
		endDate: formatDate(weekEndDate!, { locale: 'en-CA' }),
		fields: ['transactions,date,description,typeDesc,toTeam,fromTeam,id,name,fullName,person'],
		...params,
	})
}
