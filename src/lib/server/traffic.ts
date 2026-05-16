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
