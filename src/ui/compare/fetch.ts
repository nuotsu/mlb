import { combineStats, positionsPlayed, statsFor, type ComparePlayer } from '#lib/compare.js'
import { fetchMLB } from '#lib/fetch/index.js'
import { SCOPES, type CompareQuery } from './options'

/**
 * Every stat in the group is fetched at once, so toggling stats is instant and only a change of
 * players, group, or scope goes back to the API. Runs in the browser, straight to the Stats API.
 */
export async function fetchComparison(query: CompareQuery): Promise<ComparePlayer[]> {
	const { ids, group, scope, season, startDate, endDate, opposingTeamId } = query
	const { types } = SCOPES.find((s) => s.id === scope) ?? SCOPES[0]

	const hydration = [
		`group=[${group}]`,
		`type=[${types.join(',')}]`,
		['season', 'projected'].includes(scope) && `season=${season}`,
		scope === 'dates' && `startDate=${startDate},endDate=${endDate}`,
		scope === 'vsTeam' && opposingTeamId && `opposingTeamId=${opposingTeamId}`,
	]
		.filter(Boolean)
		.join(',')

	const { people = [] } = await fetchMLB<MLB.PersonResponse>('/api/v1/people', {
		personIds: ids.join(','),
		fields: [
			'people,id,fullName,primaryPosition,abbreviation,code,currentTeam',
			'stats,type,displayName,splits,team,stat,position',
			statsFor(group)
				.map((s) => s.key)
				.join(','),
		],
		hydrate: `stats(${hydration})`,
	})

	const byId = new Map(
		(people as (MLB.Person & { stats?: MLB.PlayerStats[]; currentTeam?: MLB.Team })[]).map((p) => [
			p.id,
			p,
		]),
	)

	// Keep the order players were added in, whatever order the API returns
	return ids.flatMap((id) => {
		const person = byId.get(id)
		if (!person) return []

		const positions = group === 'fielding' ? positionsPlayed(person.stats) : []

		return {
			id,
			fullName: person.fullName,
			position: positions.length ? positions.join(', ') : person.primaryPosition?.abbreviation,
			teamId: person.currentTeam?.id,
			stat: combineStats(person.stats, group),
		}
	})
}
