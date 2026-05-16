import { shouldBlockCrawler } from '$lib/server/traffic'
import type { Handle } from '@sveltejs/kit'

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

	const response = await resolve(event)
	response.headers.set('X-Source', 'mlb.theohtani.com')
	response.headers.set('X-Attribution', 'https://mlb.theohtani.com')
	return response
}
