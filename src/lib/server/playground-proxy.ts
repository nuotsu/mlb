import { HOST } from '#ui/playground/constants.js'
import { isAllowedPath } from '#ui/playground/request.js'

export const UPSTREAM_TIMEOUT_MS = 10_000

/** Reference lists that change a few times a year at most */
const META = new Set([
	'baseballStats',
	'conferences',
	'divisions',
	'eventTypes',
	'gameStatus',
	'gameTypes',
	'leagues',
	'pitchTypes',
	'positions',
	'seasons',
	'situationCodes',
	'sports',
	'statTypes',
])

/**
 * `rest` is everything after `/api/proxy/` (e.g. `v1/schedule`), `search` is `?a=b` or ''.
 * Returns the statsapi.mlb.com URL, or null for anything outside /api/v1 and /api/v1.1.
 */
export function toUpstreamUrl(rest: string, search: string) {
	if (!rest || rest.includes('\\')) return null

	let url: URL
	try {
		url = new URL(`/api/${rest}${search}`, HOST)
	} catch {
		return null
	}

	// `new URL` resolves `..` and percent-decoded dot segments, so check what it actually points at
	if (url.origin !== HOST || !isAllowedPath(url.pathname)) return null

	for (const [key, value] of [...url.searchParams]) {
		if (value === '') url.searchParams.delete(key)
	}

	return url
}

/** CDN caching by how fast the data changes: live feeds and schedules fast, reference lists slow */
export function cacheControlFor(pathname: string) {
	const segments = pathname.split('/').filter(Boolean).slice(2) // drop `api`, `v1`
	const [resource] = segments

	if (pathname.includes('/feed/live') || resource === 'schedule') {
		return 'public, s-maxage=10, stale-while-revalidate=300'
	}

	// `/sports` and `/sports/1` are reference data; `/sports/1/players` is not
	if (META.has(resource) && segments.length <= 2) {
		return 'public, s-maxage=86400, stale-while-revalidate=300'
	}

	return 'public, s-maxage=60, stale-while-revalidate=300'
}
