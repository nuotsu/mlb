import { fetchMLB } from '#lib/fetch/index.js'
import { fetchSeason } from '#lib/fetch/presets.js'
import { formatDate, getToday, slash } from '#lib/temporal.js'

/** Search param holding the team page's selected date (`YYYY-MM-DD`) */
export const DATE_PARAM = 'date'

/** MLB data starts in 1876 */
const MIN_SEASON = 1876

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_MONTH = /^\d{4}-\d{2}$/

export function getTodayDate() {
	return formatDate(getToday(), { locale: 'en-CA' })
}

function isValidDate(value: string) {
	const [, year, month, day] = value.match(ISO_DATE)?.map(Number) ?? []
	if (!year || year < MIN_SEASON || year > getToday().getFullYear() + 1) return false

	// Round-trip rejects dates like 2025-02-30
	const date = new Date(slash(value))
	return date.getMonth() + 1 === month && date.getDate() === day
}

/** The selected date from the URL, or today when it's missing or malformed */
export function getSelectedDate(url: { searchParams: Pick<URLSearchParams, 'get'> }) {
	const date = url.searchParams.get(DATE_PARAM)
	return date && isValidDate(date) ? date : getTodayDate()
}

/** Memoized per team + season; failures are evicted so the next pick retries */
const seasonDefaults = new Map<string, Promise<string>>()

/**
 * The date a season opens on: today for the current season, otherwise the
 * team's last regular-season or postseason game (first game for a future one).
 */
export function fetchSeasonDefaultDate(
	team: Pick<MLB.TeamDetailed, 'id' | 'sport'>,
	season: number,
): Promise<string> {
	const currentSeason = getToday().getFullYear()
	if (season === currentSeason) return Promise.resolve(getTodayDate())

	const key = `${team.id}-${season}`
	if (seasonDefaults.has(key)) return seasonDefaults.get(key)!

	const sportId = String(team.sport?.id ?? 1)
	const isPast = season < currentSeason

	const promise = fetchMLB<MLB.ScheduleResponse>('/api/v1/schedule', {
		sportId,
		teamId: String(team.id),
		startDate: `${season}-01-01`,
		endDate: `${season}-12-31`,
		gameType: 'R,F,D,L,W',
		fields: 'dates,date',
	})
		.then(async ({ dates }) => {
			const gameDate = (isPast ? dates?.at(-1) : dates?.[0])?.date
			if (gameDate) return gameDate

			// No games for this team that season: use the league calendar
			const info = await fetchSeason(String(season), sportId).catch(() => undefined)
			return (
				(isPast
					? (info?.postSeasonEndDate ?? info?.regularSeasonEndDate)
					: info?.regularSeasonStartDate) ?? `${season}-${isPast ? '12-31' : '01-01'}`
			)
		})
		.catch((e) => {
			seasonDefaults.delete(key)
			throw e
		})

	seasonDefaults.set(key, promise)
	return promise
}

/**
 * The date to select when the calendar moves to `month` (`YYYY-MM`). A new
 * season starts on its default date; within the same season the day of the
 * month carries over, unless the month holds the season's default date.
 */
export async function getDateForMonth(
	month: string,
	current: string,
	team: Pick<MLB.TeamDetailed, 'id' | 'sport'>,
) {
	if (!ISO_MONTH.test(month)) return current

	const [year, monthNumber] = month.split('-').map(Number)
	const seasonDefault = await fetchSeasonDefaultDate(team, year).catch(() => null)

	if (seasonDefault?.startsWith(month)) return seasonDefault
	if (seasonDefault && year !== Number(current.slice(0, 4))) return seasonDefault

	const daysInMonth = new Date(year, monthNumber, 0).getDate()
	const day = Math.min(Number(current.slice(8, 10)), daysInMonth)
	return `${month}-${String(day).padStart(2, '0')}`
}
