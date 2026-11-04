import { error, json, type RequestEvent } from '@sveltejs/kit'

const MAX_BODY_BYTES = 64 * 1024

/** The session user, or a 401. Ids always come from the session, never the request. */
export function requireUser({ locals }: RequestEvent) {
	if (!locals.user) error(401, 'Not signed in')
	return locals.user
}

/**
 * Parse a JSON body from a same-origin request. SvelteKit's CSRF check only covers form
 * content types, so writes also require a matching `Origin` and a JSON content type
 * (which browsers can't send cross-origin without a CORS preflight we never allow).
 */
export async function readJson({ request, url }: RequestEvent): Promise<unknown> {
	if (request.headers.get('origin') !== url.origin) error(403, 'Cross-origin request')
	if (!request.headers.get('content-type')?.startsWith('application/json')) {
		error(415, 'Expected JSON')
	}

	const text = await request.text()
	if (text.length > MAX_BODY_BYTES) error(413, 'Body too large')

	try {
		return JSON.parse(text)
	} catch {
		error(400, 'Invalid JSON')
	}
}

/** JSON that is never cached by the browser or the CDN */
export function privateJson(data: unknown, init?: ResponseInit) {
	const response = json(data, init)
	response.headers.set('Cache-Control', 'private, no-store')
	return response
}
