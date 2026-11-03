import {
	cacheControlFor,
	toUpstreamUrl,
	UPSTREAM_TIMEOUT_MS,
} from '#lib/server/playground-proxy.js'
import { getPostHogClient } from '#lib/server/posthog.js'
import { DISTINCT_ID_HEADER } from '#ui/playground/request.js'
import type { RequestHandler } from './$types'

function error(status: number, message: string) {
	return Response.json(
		{ message },
		{ status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
	)
}

/**
 * Same-origin pass-through to the MLB Stats API for the playground.
 * The body is streamed through untouched (no JSON parse/re-serialize) and cached at the CDN.
 */
export const GET: RequestHandler = async ({ params, url, request }) => {
	const upstream = toUpstreamUrl(params.path, url.search)

	if (!upstream) return error(400, 'Only statsapi.mlb.com /api/v1 and /api/v1.1 paths are allowed.')

	getPostHogClient()?.capture({
		event: 'playground_form_submitted',
		distinctId: request.headers.get(DISTINCT_ID_HEADER) || 'anonymous',
		properties: { fetchUrl: upstream.toString() },
	})

	let response: Response

	try {
		response = await fetch(upstream, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.any([request.signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
		})
	} catch (e) {
		if (e instanceof Error && e.name === 'TimeoutError') {
			return error(504, `statsapi.mlb.com did not respond within ${UPSTREAM_TIMEOUT_MS / 1000}s.`)
		}

		return error(502, `Could not reach statsapi.mlb.com (${e instanceof Error ? e.message : e}).`)
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: {
			'Content-Type': response.headers.get('content-type') ?? 'application/json',
			'Cache-Control': response.status >= 500 ? 'no-store' : cacheControlFor(upstream.pathname),
			'X-Robots-Tag': 'noindex',
		},
	})
}
