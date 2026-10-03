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
