import { fetchMLB } from '$lib/fetch'
import { fetchFullRoster, fetchTeamTransactions } from '$lib/fetch/presets'
import { formatDate, getToday } from '$lib/temporal'
import { buildInjuredList } from '$ui/team/injured-list'
import type { PageServerLoad } from './$types'

/** How far back to scan transactions for the placement that explains an injury */
const TRANSACTION_LOOKBACK_DAYS = 90

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' })

	const teams = await fetchMLB<MLB.TeamsResponse>(
		`/api/v1/teams/${params.teamId}`,
		{
			fields: ['teams,id,name,franchiseName,clubName,teamName,abbreviation', 'sport'],
		},
		{ fetch },
	)

	const roster = await fetchMLB<MLB.RosterResponse>(
		`/api/v1/teams/${params.teamId}/roster`,
		{
			fields: ['roster', 'person,id,lastName,lastFirstName', 'position,code,abbreviation'],
			hydrate: 'person',
		},
		{ fetch },
	)

	const coaches = await fetchMLB<MLB.CoachesResponse>(
		`/api/v1/teams/${params.teamId}/coaches`,
		{
			fields: ['roster', 'person,id,lastName,lastFirstName', 'job'],
			hydrate: 'person',
		},
		{ fetch },
	)

	const today = getToday()
	const lookback = new Date(today)
	lookback.setDate(lookback.getDate() - TRANSACTION_LOOKBACK_DAYS)

	return {
		team: teams.teams[0],
		roster,
		coaches,

		/**
		 * Streamed so the page paints without waiting on two more requests. The
		 * Stats API has no injury reason or return date, so both are derived: the
		 * reason from the placing transaction, the date from IL start + term.
		 * Failures resolve to `null` so the section degrades instead of erroring.
		 */
		injuredList: Promise.all([
			fetchFullRoster(params.teamId, { fetch }),
			fetchTeamTransactions(
				{
					teamId: params.teamId,
					startDate: formatDate(lookback, { locale: 'en-CA' }),
					endDate: formatDate(today, { locale: 'en-CA' }),
				},
				{ fetch },
			),
		])
			.then(([fullRoster, transactions]) =>
				buildInjuredList(fullRoster.roster ?? [], transactions.transactions ?? [], today),
			)
			.catch((e) => {
				console.error('[injuredList]', e)
				return null
			}),
	}
}
