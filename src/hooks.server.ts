import type { Handle } from '@sveltejs/kit/hooks'
import { authEnabled, getAuth } from '#lib/server/auth.js'
import { shouldBlockCrawler } from '#lib/server/traffic.js'
import { building } from '$app/env'
import { getSessionCookie } from 'better-auth/cookies'
import { isAuthPath, svelteKitHandler } from 'better-auth/svelte-kit'

const PRIVATE_CACHE = 'private, no-store'

export const handle: Handle = async ({ event, resolve }) => {
	if (shouldBlockCrawler(event.url.pathname, event.request.headers.get('user-agent'))) {
		return new Response('Crawler access to this route is not permitted.', {
			status: 403,
			headers: {
				'Cache-Control': 'public, max-age=86400',
				'X-Robots-Tag': 'noindex, nofollow',
			},
		})
	}

	event.locals.user = null
	event.locals.session = null

	// Only touch auth when it's configured and the request carries a session cookie,
	// so signed-out traffic (and its public CDN caching) is exactly as before
	const hasSession = authEnabled && !building && !!getSessionCookie(event.request.headers)
	const auth = authEnabled && !building ? getAuth() : null

	if (auth && hasSession) {
		const result = await auth.api
			.getSession({ headers: event.request.headers })
			.catch((error: unknown) => {
				console.error('[auth] getSession failed', error)
				return null
			})
		event.locals.user = result?.user ?? null
		event.locals.session = result?.session ?? null
	}

	const response = auth
		? await svelteKitHandler({ event, resolve, auth, building })
		: await resolve(event)

	// Never let the CDN store anything personal: auth endpoints, or any page/data response
	// rendered for a request with a session cookie. Signed-out responses keep their headers.
	if (hasSession || (auth && isAuthPath(event.url.toString(), auth.options))) {
		setPrivate(response)
	}

	setHeader(response, 'X-Source', 'mlb.theohtani.com')
	setHeader(response, 'X-Attribution', 'https://mlb.theohtani.com')
	return response
}

function setPrivate(response: Response) {
	setHeader(response, 'Cache-Control', PRIVATE_CACHE)
	setHeader(response, 'CDN-Cache-Control', 'no-store')
	setHeader(response, 'Vercel-CDN-Cache-Control', 'no-store')
}

/** Some responses (e.g. `Response.redirect`) have immutable headers */
function setHeader(response: Response, key: string, value: string) {
	try {
		response.headers.set(key, value)
	} catch {}
}
