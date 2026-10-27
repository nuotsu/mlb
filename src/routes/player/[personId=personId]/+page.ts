import { error } from '@sveltejs/kit'
import { fetchMLB, notFoundOnMlb404 } from '#lib/fetch/index.js'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' })

	const personId = params.personId

	const [person, baseballStats, transactions] = await Promise.all([
		fetchMLB<MLB.PersonResponse>(
			`/api/v1/people/${personId}`,
			{
				hydrate: [
					'team,currentTeam,preferredTeam,rosterEntries,draft,relatives,awards(team)',
					'stats(group=[pitching,hitting],type=[yearByYear,career])',
				],
			},
			{ fetch },
		),
		fetchMLB<MLB.BaseballStat[]>('/api/v1/baseballStats', undefined, { fetch }),
		// Optional: only a retirement date is read from it, so a failure shouldn't take the page down
		fetchMLB<MLB.TransactionsResponse>(
			'/api/v1/transactions',
			{ playerId: personId, fields: 'transactions,date,typeCode' },
			{ fetch },
		).catch(() => undefined),
	]).catch((e) => notFoundOnMlb404(e, 'Player not found'))

	const player = person.people?.[0]
	if (!player) error(404, 'Player not found')

	// The API has no retirement field, only a "RET" transaction, and not every retired player has one.
	// Players who came out of retirement are active again, so only inactive players get a date.
	const retirementDate = player.active
		? undefined
		: transactions?.transactions?.findLast((t) => t.typeCode === 'RET')?.date

	return {
		person: player,
		retirementDate,
		baseballStats,
	}
}
