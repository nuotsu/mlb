import { gameState } from './series'

/**
 * The team page is pinned to a season and an "as of" date through its search
 * params, so a past season survives a reload and can be shared. The current
 * season as of today is the default and keeps the URL bare.
 */
export const SEASON_PARAM = 'season'
export const DATE_PARAM = 'date'

const MIN_SEASON = 1876
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export type TeamSeason = {
	season: number
	/** `null` when the URL has no usable date, so the season's default applies */
	date: string | null
}

function isValidDate(date: string) {
	const [, y, m, d] = date.match(ISO_DATE) ?? []
	if (!y) return false

	const parsed = new Date(Number(y), Number(m) - 1, Number(d))
	return parsed.getMonth() === Number(m) - 1 && parsed.getDate() === Number(d)
}

/**
 * Season and date from the search params, checked against `today` (YYYY-MM-DD).
 * A missing season is read off the date; anything out of range falls back to
 * the current season. A date outside the season, or after today, is dropped.
 */
export function parseTeamSeason(searchParams: URLSearchParams, today: string): TeamSeason {
	const currentSeason = Number(today.slice(0, 4))

	const dateParam = searchParams.get(DATE_PARAM) ?? ''
	const validDate = isValidDate(dateParam) ? dateParam : null

	const seasonParam = searchParams.get(SEASON_PARAM) ?? validDate?.slice(0, 4) ?? ''
	const parsed = /^\d{4}$/.test(seasonParam) ? Number(seasonParam) : NaN
	const season = parsed >= MIN_SEASON && parsed <= currentSeason ? parsed : currentSeason

	const date =
		validDate && validDate.startsWith(`${season}-`) && validDate <= today ? validDate : null

	return { season, date }
}

/**
 * Search params for `season` as of `date`, keeping any unrelated params. The
 * current season as of today drops both; a season without a date leaves the
 * server to pick that season's default.
 */
export function teamSeasonSearchParams(
	base: URLSearchParams,
	{ season, date }: { season: number; date?: string | null },
	today: string,
) {
	const params = new URLSearchParams(base)
	params.delete(SEASON_PARAM)
	params.delete(DATE_PARAM)

	const isLive = season === Number(today.slice(0, 4)) && (!date || date === today)

	if (!isLive) {
		params.set(SEASON_PARAM, String(season))
		if (date) params.set(DATE_PARAM, date)
	}

	return params
}

/** `pathname` with `params`, or the bare path when there's nothing to keep */
export function withSearch(pathname: string, params: URLSearchParams) {
	const search = params.toString()
	return search ? `${pathname}?${search}` : pathname
}

/** The last day the team took the field in `schedule`, regular season or postseason. */
export function lastGameDate(schedule: Pick<MLB.ScheduleResponse, 'dates'> | undefined) {
	return (schedule?.dates ?? [])
		.filter(({ games }) =>
			games?.some(({ status }) => !['postponed', 'cancelled'].includes(gameState(status))),
		)
		.map(({ date }) => date)
		.sort()
		.at(-1)
}
