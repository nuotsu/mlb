import { fetchMLB, notFoundOnMlb404 } from '#lib/fetch/index.js'
import { NPB_SPORT_ID, NPB_TEAMS } from '#lib/npb.js'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' })

	const searchParams = Object.fromEntries(url.searchParams.entries())

	const [teams, availableSportIds] = await Promise.all([
		fetchMLB<MLB.TeamsResponse>(
			'/api/v1/teams',
			{
				sportId: '1',
				fields: [
					'teams,id,name,abbreviation',
					'sport,abbreviation',
					'league,name,division,sortOrder,nameShort',
				],
				hydrate: 'sport,division',
				...searchParams,
			},
			{ fetch },
		).catch((e) => notFoundOnMlb404(e, 'No teams found for this sport')),
		fetchSportIdsWithTeams(searchParams.season, fetch),
	])

	if (searchParams.sportId === String(NPB_SPORT_ID)) addMissingNpbTeams(teams)

	return {
		teams,
		availableSportIds,
	}
}

/**
 * The Stats API files the Giants, Tigers and Fighters under International Baseball (sportId 51),
 * so `sportId=31` leaves them out. Fill them in from {@link NPB_TEAMS}.
 */
function addMissingNpbTeams(teams: MLB.TeamsResponse) {
	const list = (teams.teams ??= []) as MLB.TeamDetailed[]
	const sport = list[0]?.sport
	const seen = new Set(list.map((team) => team.id))

	for (const { id, name, abbreviation } of Object.values(NPB_TEAMS)) {
		if (seen.has(id)) continue
		seen.add(id)
		list.push({ id, name, abbreviation, sport } as MLB.TeamDetailed)
	}
}

/**
 * Sports with at least one team, for the sport select (e.g. Negro League and Olympic Baseball
 * have none). `undefined` on failure leaves every option enabled.
 */
async function fetchSportIdsWithTeams(season: string | undefined, fetch: typeof globalThis.fetch) {
	const all = await fetchMLB<MLB.TeamsResponse>(
		'/api/v1/teams',
		{ fields: ['teams,sport,id'], season },
		{ fetch },
	).catch(() => undefined)
	if (!all?.teams) return undefined

	const ids = new Set(
		(all.teams as MLB.TeamDetailed[])
			.map((team) => team.sport?.id)
			.filter((id) => id !== undefined),
	)
	// The Stats API files some NPB clubs elsewhere, but NPB always has teams (see above)
	ids.add(NPB_SPORT_ID)
	return [...ids]
}
