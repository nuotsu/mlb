import { cacheControlForSeasonPage } from '$lib/cache-control'
import { fetchMLB } from '$lib/fetch'
import { wildCardSpots } from '$lib/postseason/bracket'
import { addDays, formatDate, getToday } from '$lib/temporal'
import type { PageLoad } from './$types'

/** How far back the "Change" column looks. */
const COMPARISON_DAYS = 7

export const load: PageLoad = async ({ params, url, setHeaders }) => {
	setHeaders({ 'cache-control': cacheControlForSeasonPage(params.season) })

	const sportId = url.searchParams.get('sportId') ?? '1'
	const requestedGameType = url.searchParams.get('gameType') ?? 'R'

	/**
	 * - `division`: each league split into its divisions (the default)
	 * - `playoff`: each league's division leaders and wild card race, from the regular season
	 * - `mlb`: every team ranked together, from the regular season
	 */
	const view =
		sportId === '1' && requestedGameType === 'P'
			? 'playoff'
			: sportId === '1' && requestedGameType === 'MLB'
				? 'mlb'
				: 'division'

	// The playoff and MLB views are both built from regular-season records.
	const gameType = view === 'division' ? requestedGameType : 'R'

	const [{ leagues: allLeagues }, seasonInfo] = await Promise.all([
		fetchMLB<MLB.LeaguesResponse>('/api/v1/leagues', {
			season: params.season,
			fields: 'leagues,id,divisionsInUse,sport,id',
		}),
		fetchMLB<MLB.SeasonResponse>('/api/v1/seasons', {
			sportId,
			season: params.season,
			fields: [
				'seasons,springStartDate,regularSeasonStartDate,postSeasonStartDate',
				'springEndDate,regularSeasonEndDate,postSeasonEndDate',
			],
		}).then((r) => r.seasons?.[0]),
	])

	const availableGameTypes = [
		seasonInfo?.springStartDate && 'S',
		seasonInfo?.regularSeasonStartDate && 'R',
		seasonInfo?.postSeasonStartDate && 'P',
		sportId === '1' && seasonInfo?.regularSeasonStartDate && 'MLB',
	].filter(Boolean) as string[]

	const matchesGameType = (l: MLB.League) =>
		gameType === 'S' ? !l.divisionsInUse : l.divisionsInUse

	const leagueId = allLeagues
		.filter((l) => l.sport?.id === Number(sportId) && matchesGameType(l))
		.map((l) => l.id)
		.join(',')

	const availableSportIds = [
		...new Set(
			allLeagues
				.filter(matchesGameType)
				.map((l) => l.sport?.id)
				.filter(Boolean),
		),
	] as number[]

	const standingsType =
		gameType === 'S' ? 'springTraining' : gameType === 'P' ? 'postseason' : 'regularSeason'

	// A finished season has no "last week", so compare against its final week instead.
	const today = formatDate(getToday(), { locale: 'en-CA' })
	const startDate =
		gameType === 'S'
			? seasonInfo?.springStartDate
			: gameType === 'P'
				? seasonInfo?.postSeasonStartDate
				: seasonInfo?.regularSeasonStartDate
	const endDate =
		gameType === 'S'
			? seasonInfo?.springEndDate
			: gameType === 'P'
				? seasonInfo?.postSeasonEndDate
				: seasonInfo?.regularSeasonEndDate
	const comparisonDate = addDays(endDate && endDate < today ? endDate : today, -COMPARISON_DAYS)

	const [standings, previousStandings] = await Promise.all([
		fetchMLB<MLB.StandingsResponse>('/api/v1/standings', {
			leagueId,
			season: params.season,
			standingsType,
			hydrate: 'division,team',
			fields: [
				'records,sport,division,nameShort,league,springLeague,id,name',
				'teamRecords,wins,losses,winningPercentage,gamesBack,streak,streakCode,leagueRank,divisionRank',
				'divisionLeader,leagueGamesBack,wildCardRank,wildCardGamesBack,sportRank,sportGamesBack',
				'magicNumber,eliminationNumber,wildCardEliminationNumber,clinched',
				'team,id,name,clubName,teamName,abbreviation',
			],
		}),
		// Standings snapshots only exist within the season, and dated snapshots aren't
		// guaranteed for every standingsType — fall back to no comparison rather than erroring.
		!startDate || comparisonDate >= startDate
			? fetchMLB<MLB.StandingsResponse>('/api/v1/standings', {
					leagueId,
					season: params.season,
					standingsType,
					date: comparisonDate,
					fields: 'records,teamRecords,divisionRank,leagueRank,sportRank,team,id',
				}).catch(() => null)
			: null,
	])

	// Movement is measured within whatever each view ranks teams against.
	const rankKey = ({ division: 'divisionRank', playoff: 'leagueRank', mlb: 'sportRank' } as const)[
		view
	]

	const previousRanks = new Map(
		(previousStandings?.records ?? []).flatMap(({ teamRecords }) =>
			teamRecords.map((record) => [record.team.id, Number(record[rankKey])] as const),
		),
	)

	/** Team ID to positions gained since `comparisonDate`; positive means moved up. */
	const rankChanges: Record<number, number> = {}

	for (const { teamRecords } of standings.records) {
		for (const record of teamRecords) {
			const { team } = record
			const previous = previousRanks.get(team.id)
			const current = Number(record[rankKey])
			if (!previous || !current) continue
			rankChanges[team.id] = previous - current
		}
	}

	return {
		standings,
		standingsType,
		view,
		wildCardSpots: wildCardSpots(Number(params.season)),
		rankChanges,
		comparisonDate,
		availableGameTypes,
		availableSportIds,
	}
}
