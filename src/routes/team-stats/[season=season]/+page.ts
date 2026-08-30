import { cacheControlForSeasonPage } from '$lib/cache-control'
import { fetchMLB } from '$lib/fetch'
import { getToday } from '$lib/temporal'
import type { PageLoad } from './$types'
import { HITTING_STATS, PITCHING_STATS, rankTeams, type StatGroup } from './rank'

export const load: PageLoad = async ({ params, url, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': cacheControlForSeasonPage(params.season) })

	const hittingSortStat = url.searchParams.get('hittingSortStat') ?? 'homeRuns'
	const pitchingSortStat = url.searchParams.get('pitchingSortStat') ?? 'era'
	const gameType = url.searchParams.get('gameType') ?? 'R'
	const sportId = url.searchParams.get('sportId') ?? '1'

	const today = getToday()
	const season = Number(params.season)

	// Months yet to be played hold no games: a past season offers all twelve, the
	// current one stops at this month, and a future one has nothing to offer.
	const maxMonth =
		season < today.getFullYear() ? 12 : season > today.getFullYear() ? 0 : today.getMonth() + 1

	const requestedMonth = Number(url.searchParams.get('month'))
	const month =
		Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= maxMonth
			? requestedMonth
			: null

	const fetchTeamStats = (group: StatGroup, stats: string[]) =>
		fetchMLB<MLB.TeamStatsResponse>(
			'/api/v1/teams/stats',
			{
				// `byMonth` splits a team's season into one row per month; `season` is the single total.
				stats: month ? 'byMonth' : 'season',
				group,
				season: params.season,
				gameType,
				sportIds: sportId,
				fields: ['stats,splits,month', 'team,id,name', `stat,${stats.join(',')}`],
			},
			{ fetch },
		)

	const [baseballStats, { teams }, hitting, pitching, { leagues }, seasonInfo] = await Promise.all([
		fetchMLB<MLB.BaseballStat[]>('/api/v1/baseballStats', undefined, { fetch }),
		fetchMLB<MLB.TeamsResponse>(
			'/api/v1/teams',
			{
				sportId,
				season: params.season,
				fields: [
					'teams,id,name,clubName,teamName,abbreviation',
					'league,id,name',
					'division,id',
					'sport,id',
				],
			},
			{ fetch },
		),
		fetchTeamStats('hitting', HITTING_STATS),
		fetchTeamStats('pitching', PITCHING_STATS),
		fetchMLB<MLB.LeaguesResponse>(
			'/api/v1/leagues',
			{
				season: params.season,
				fields: 'leagues,id,name,abbreviation,nameShort,divisionsInUse,sport,id',
			},
			{ fetch },
		),
		fetchMLB<MLB.SeasonResponse>(
			'/api/v1/seasons',
			{
				sportId,
				season: params.season,
				fields: 'seasons,springStartDate,regularSeasonStartDate,postSeasonStartDate',
			},
			{ fetch },
		).then((r) => r.seasons?.[0]),
	])

	/**
	 * The team list is what scopes the table to the selected sport, and carries
	 * the club names and league that the stat splits only reference by id.
	 */
	const teamsById = new Map(
		(teams ?? []).map((team) => [team.id, team as MLB.TeamDetailed] as const),
	)

	const leagueAbbreviations = new Map(
		(leagues ?? []).map((l) => [l.id, l.abbreviation || l.nameShort || l.name] as const),
	)

	const rowsFor = ({ stats }: MLB.TeamStatsResponse) =>
		(stats ?? [])
			.flatMap((s) => s.splits ?? [])
			.filter((split) => !month || split.month === month)
			.flatMap((split) => {
				const team = split.team && teamsById.get(split.team.id)
				if (!team) return []

				return [
					{
						team,
						stat: split.stat ?? {},
						league: leagueAbbreviations.get(team.league?.id ?? 0) ?? team.league?.name ?? '',
					},
				]
			})

	const availableGameTypes = [
		seasonInfo?.springStartDate && 'S',
		seasonInfo?.regularSeasonStartDate && 'R',
		seasonInfo?.postSeasonStartDate && 'P',
	].filter(Boolean) as string[]

	const availableSportIds = [
		...new Set(
			leagues
				.filter((l) => (gameType === 'S' ? !l.divisionsInUse : l.divisionsInUse))
				.map((l) => l.sport?.id)
				.filter(Boolean),
		),
	] as number[]

	return {
		month,
		maxMonth,
		baseballStats,
		hitting: {
			group: 'hitting' as StatGroup,
			param: 'hittingSortStat',
			sortStat: hittingSortStat,
			stats: HITTING_STATS,
			rows: rankTeams(rowsFor(hitting), hittingSortStat, 'hitting'),
		},
		pitching: {
			group: 'pitching' as StatGroup,
			param: 'pitchingSortStat',
			sortStat: pitchingSortStat,
			stats: PITCHING_STATS,
			rows: rankTeams(rowsFor(pitching), pitchingSortStat, 'pitching'),
		},
		availableSportIds,
		availableGameTypes,
	}
}
