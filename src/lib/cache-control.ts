const DAY_MS = 86_400_000

export function scheduleDateOffsetDays(date: string, today = getScheduleToday()) {
	const target = new Date(date.replace(/-/g, '/'))
	return Math.round((target.getTime() - today.getTime()) / DAY_MS)
}

export function getScheduleToday() {
	const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(
		new Date(),
	)
	return new Date(dateStr.replace(/-/g, '/'))
}

export function cacheControlForScheduleDay(date: string) {
	const offset = scheduleDateOffsetDays(date)
	if (offset === 0) return 'public, s-maxage=60, stale-while-revalidate=120'
	if (offset < 0) return 'public, s-maxage=86400, stale-while-revalidate=604800'
	return 'public, s-maxage=3600, stale-while-revalidate=86400'
}

export function cacheControlForScheduleWeek(weekStartDate: string) {
	const offset = scheduleDateOffsetDays(weekStartDate)
	if (offset >= -6 && offset <= 0) return 'public, s-maxage=60, stale-while-revalidate=120'
	if (offset < -6) return 'public, s-maxage=86400, stale-while-revalidate=604800'
	return 'public, s-maxage=3600, stale-while-revalidate=86400'
}

export function cacheControlForSeasonPage(season: string | number) {
	const current = getScheduleToday().getFullYear()
	if (Number(season) < current) return 'public, s-maxage=604800, stale-while-revalidate=2592000'
	return 'public, s-maxage=900, stale-while-revalidate=3600'
}

export function cacheControlForGame(state: MLB.Game['status']['abstractGameState'] | undefined) {
	switch (state) {
		case 'Final':
			return 'public, s-maxage=604800, stale-while-revalidate=2592000'
		case 'Live':
			return 'public, s-maxage=15, stale-while-revalidate=60'
		case 'Preview':
			return 'public, s-maxage=300, stale-while-revalidate=3600'
		default:
			return 'public, s-maxage=3600, stale-while-revalidate=86400'
	}
}
