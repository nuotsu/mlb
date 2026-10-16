import { redirect } from '@sveltejs/kit'
import { fetchMLB } from '#lib/fetch/index.js'
import {
	fetchRosterByType,
	fetchSeasonRoster,
	fetchTeamSeasonSchedule,
	fetchTeamTransactions,
} from '#lib/fetch/presets.js'
import { addDays, formatDate, getToday } from '#lib/temporal.js'
import { buildInjuredList } from '#ui/team/injured-list.js'
import {
	lastGameDate,
	parseTeamSeason,
	teamSeasonSearchParams,
	withSearch,
} from '#ui/team/season.js'
import type { PageServerLoad } from './$types'

/** How far back to scan transactions for the placement that explains an injury */
const TRANSACTION_LOOKBACK_DAYS = 90

export const load: PageServerLoad = async ({ params, url, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' })

	const today = formatDate(getToday(), { locale: 'en-CA' })
	const currentSeason = Number(today.slice(0, 4))
	const { season, date: dateParam } = parseTeamSeason(url.searchParams, today)
	const isCurrentSeason = season === currentSeason

	const teams = await fetchMLB<MLB.TeamsResponse>(
		`/api/v1/teams/${params.teamId}`,
		{
			fields: [
				'teams,id,name,franchiseName,clubName,teamName,abbreviation,firstYearOfPlay',
				'sport',
			],
		},
		{ fetch },
	)
	const team = teams.teams[0] as MLB.TeamDetailed

	/**
	 * A past season opens on the last day the team played that year rather than
	 * on today, and that date is written into the URL so a reload or a shared
	 * link lands on the same day.
	 */
	if (!isCurrentSeason && !dateParam) {
		const schedule = await fetchTeamSeasonSchedule(
			params.teamId,
			season,
			{
				sportId: String(team.sport?.id ?? 1),
				fields: ['dates,date,games,status,detailedState,abstractGameState'],
			},
			{ fetch },
		).catch(() => undefined)

		const date = lastGameDate(schedule) ?? `${season}-12-31`
		redirect(
			307,
			withSearch(url.pathname, teamSeasonSearchParams(url.searchParams, { season, date }, today)),
		)
	}

	const date = dateParam ?? today
	const lookback = addDays(date, -TRANSACTION_LOOKBACK_DAYS)

	return {
		team,
		season,
		date,
		today,

		/** Streamed, like everything below, so switching seasons repaints right away */
		roster: fetchSeasonRoster(params.teamId, { season, isCurrent: isCurrentSeason }, { fetch })
			.then(({ roster }) => roster ?? [])
			.catch((e) => {
				console.error('[roster]', e)
				return null
			}),

		coaches: fetchMLB<MLB.CoachesResponse>(
			`/api/v1/teams/${params.teamId}/coaches`,
			{
				season: String(season),
				fields: ['roster', 'person,id,lastName,lastFirstName', 'job'],
				hydrate: 'person',
			},
			{ fetch },
		)
			.then(({ roster }) => roster ?? [])
			.catch(() => []),

		/**
		 * The IL as it stood on `date`. The Stats API has no injury reason or return
		 * date, so both are derived: the reason from the placing transaction, the
		 * date from IL start + term. The 40-man roster keeps the list to big
		 * leaguers; the full roster is what carries the 60-day IL players, who hold
		 * no 40-man spot. Failures resolve to `null` so the section degrades
		 * instead of erroring.
		 */
		injuredList: Promise.all([
			fetchRosterByType(params.teamId, 'fullRoster', { fetch, date }),
			fetchRosterByType(params.teamId, '40Man', { fetch, date }),
			fetchTeamTransactions(
				{ teamId: params.teamId, startDate: lookback, endDate: date },
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
