import { goto } from '$app/navigation'
import { page } from '$app/state'

const DEFAULTS = {
	sportId: '1',
}

export function maintainSearchParams(pathname: string) {
	const url = new URL(page.url.href)
	url.pathname = pathname

	const searchParams = new URLSearchParams(page.url.search)

	for (const [key, value] of searchParams.entries()) {
		if (DEFAULTS[key as keyof typeof DEFAULTS] === value) {
			url.searchParams.delete(key)
		} else {
			url.searchParams.set(key, value)
		}
	}

	return url.toString()
}

/**
 * The address as it stands. `page.url` keeps the last full navigation's, so it misses
 * shallow updates like a pill switcher's `?view=`.
 */
export function currentUrl() {
	return page.shallow?.url ?? page.url
}

/**
 * Keep a view choice in the address so a shared link opens it, without rerunning `load`.
 * The default value leaves the parameter off.
 */
export function setViewParam(key: string, value: string, fallback: string) {
	const url = new URL(currentUrl().href)
	if (value === fallback) url.searchParams.delete(key)
	else url.searchParams.set(key, value)
	return goto(url, { shallow: true, replace: true, state: page.state })
}
