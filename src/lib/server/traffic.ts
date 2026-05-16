/** Paths that trigger heavy SSR + multiple upstream MLB API calls. */
const EXPENSIVE_PREFIXES = ['/game/', '/schedule/'] as const

const CRAWLER_UA =
	/bot|crawl|spider|slurp|wget|curl|python|scrapy|ia_archiver|headless|phantom|selenium|puppeteer|playwright|httpclient|go-http|java\/|libwww|okhttp|postman|insomnia|ahrefs|semrush|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|anthropic|ccbot|googlebot|bingbot|duckduckbot|applebot|yandexbot/i

export function isExpensivePath(pathname: string) {
	return EXPENSIVE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export function isCrawlerUserAgent(userAgent: string | null | undefined) {
	if (!userAgent) return true
	return CRAWLER_UA.test(userAgent)
}

/** Block crawlers from SSR-heavy routes (robots.txt is not enough for bad bots). */
export function shouldBlockCrawler(pathname: string, userAgent: string | null | undefined) {
	return isExpensivePath(pathname) && isCrawlerUserAgent(userAgent)
}

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
