import { fetchMLB } from '#lib/fetch/index.js'
import { fetchRosterByType, fetchTeamTransactions } from '#lib/fetch/presets.js'
import { addDays, getToday } from '#lib/temporal.js'
import { buildInjuredList } from '#ui/team/injured-list.js'
import { getSelectedDate } from '#ui/team/selected-date.js'
import type { PageServerLoad } from './$types'

/** How far back to scan transactions for the placement that explains an injury */
const TRANSACTION_LOOKBACK_DAYS = 90

export const load: PageServerLoad = async ({ params, url, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' })

	/** Everything below is as of the selected date, not today */
	const date = getSelectedDate(url)
	const season = date.slice(0, 4)
	const isPastSeason = Number(season) < getToday().getFullYear()

	/**
	 * A date can predate a past season's rosters (or fall where the API kept
	 * none), so an empty answer there falls back to the season's roster.
	 */
	async function asOfDate(fetchRoster: (params: Fetch.Params) => Promise<MLB.RosterResponse>) {
		const roster = await fetchRoster({ date })
		if (roster.roster?.length || !isPastSeason) return roster
		return fetchRoster({ season })
	}

	const teams = await fetchMLB<MLB.TeamsResponse>(
		`/api/v1/teams/${params.teamId}`,
		{
			fields: ['teams,id,name,franchiseName,clubName,teamName,abbreviation', 'sport'],
		},
		{ fetch },
	)

	const roster = await asOfDate((rosterParams) =>
		fetchMLB<MLB.RosterResponse>(
			`/api/v1/teams/${params.teamId}/roster`,
			{
				...rosterParams,
				rosterType: 'active',
				fields: ['roster', 'person,id,lastName,lastFirstName', 'position,code,abbreviation'],
				hydrate: 'person',
			},
			{ fetch },
		),
	)

	const coaches = await fetchMLB<MLB.CoachesResponse>(
		`/api/v1/teams/${params.teamId}/coaches`,
		{
			date,
			fields: ['roster', 'person,id,lastName,lastFirstName', 'job'],
			hydrate: 'person',
		},
		{ fetch },
	)

	return {
		team: teams.teams[0],
		roster,
		coaches,

		/**
		 * Streamed so the page paints without waiting on three more requests. The
		 * Stats API has no injury reason or return date, so both are derived: the
		 * reason from the placing transaction, the date from IL start + term. The
		 * 40-man roster keeps the list to big leaguers; the full roster is what
		 * carries the 60-day IL players, who hold no 40-man spot.
		 * Failures resolve to `null` so the section degrades instead of erroring.
		 */
		injuredList: Promise.all([
			asOfDate((rosterParams) =>
				fetchRosterByType(params.teamId, 'fullRoster', { fetch, ...rosterParams }),
			),
			asOfDate((rosterParams) =>
				fetchRosterByType(params.teamId, '40Man', { fetch, ...rosterParams }),
			),
			fetchTeamTransactions(
				{
					teamId: params.teamId,
					startDate: addDays(date, -TRANSACTION_LOOKBACK_DAYS),
					endDate: date,
				},
				{ fetch },
			),
		])
			.then(([fullRoster, fortyMan, transactions]) =>
				buildInjuredList(fullRoster.roster ?? [], transactions.transactions ?? [], {
					fortyManIds: new Set((fortyMan.roster ?? []).map(({ person }) => person.id)),
					today: date,
				}),
			)
			.catch((e) => {
				console.error('[injuredList]', e)
				return null
			}),
	}
}
