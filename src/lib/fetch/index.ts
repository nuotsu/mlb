import { error } from '@sveltejs/kit'
import { HOST } from '$ui/playground/constants'
import { fetchLiveMLB } from './live.svelte'

const TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 2

function isTimeoutError(error: unknown) {
	return (
		error instanceof Error &&
		(error.name === 'TimeoutError' ||
			error.name === 'AbortError' ||
			error.message.includes('aborted due to timeout'))
	)
}

export async function fetchMLB<T>(
	endpoint: string,
	params?: Fetch.Params,
	{ host = HOST, fetch: _fetch = fetch }: { host?: string; fetch?: typeof fetch } = {},
) {
	const url = new URL(endpoint, host)

	for (const [key, value] of Object.entries(params ?? {})) {
		if (value == null) continue
		url.searchParams.set(key, typeof value !== 'string' ? value.flat().join(',') : value)
	}

	const decodedUrl = decodeURIComponent(url.toString())
	let lastError: unknown

	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			const response = await _fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) })

			if (!response.ok) {
				const body = await response.text().catch(() => '(unreadable body)')
				const httpError = new Error(`MLB API ${response.status}: ${url.pathname}`)
				console.error('[fetchMLB] HTTP error', {
					status: response.status,
					url: decodedUrl,
					body,
				})
				throw httpError
			}

			const json = await response.json()
			if (typeof json?.messageNumber === 'number') {
				const apiError = new Error(`MLB API error: ${json.message ?? 'unknown'} (${url.pathname})`)
				console.error('[fetchMLB] Error body on 200', {
					messageNumber: json.messageNumber,
					message: json.message,
					url: decodedUrl,
				})
				throw apiError
			}
			return json as T
		} catch (err) {
			lastError = err
			if (err instanceof Error && err.message.startsWith('MLB API')) throw err

			if (isTimeoutError(err) && attempt < MAX_ATTEMPTS) {
				console.warn('[fetchMLB] Timeout, retrying', { url: decodedUrl, attempt })
				continue
			}

			console.error('[fetchMLB] Unexpected error', {
				url: decodedUrl,
				error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
			})
			throw err
		}
	}

	throw lastError
}

/** Map MLB API 404s to SvelteKit 404s so missing data isn't a 500. */
export function notFoundOnMlb404(e: unknown, message = 'Not found'): never {
	if (e instanceof Error && e.message.startsWith('MLB API 404')) error(404, message)
	throw e
}

export function createPreset<TArgs extends unknown[], T>(
	build: (...args: TArgs) => { endpoint: string; params?: Fetch.Params },
) {
	const fn = async (...args: TArgs): Promise<T> => {
		const { endpoint, params } = build(...args)
		return fetchMLB<T>(endpoint, params)
	}

	fn.live = (...args: TArgs) => {
		const { endpoint, params } = build(...args)
		return fetchLiveMLB<T>(endpoint, params)
	}

	return fn as ((...args: TArgs) => Promise<T>) & {
		live: (...args: TArgs) => ReturnType<typeof fetchLiveMLB<T>>
	}
}
