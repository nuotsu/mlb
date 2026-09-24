import { error, json } from '@sveltejs/kit'
import { cacheControlForSeasonPage } from '$lib/cache-control'
import { fetchPitchArsenal } from '$lib/fetch/savant'
import type { RequestHandler } from './$types'

/**
 * Savant's CSV isn't CORS-enabled and runs to megabytes per season, so the
 * server fetches it and returns only the per-pitch summary.
 */
export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const season = url.searchParams.get('season') ?? ''
	if (!/^\d{4}$/.test(season)) error(400, 'Invalid season')

	try {
		const arsenal = await fetchPitchArsenal({ personId: params.personId, season }, { fetch })

		return json(arsenal, {
			headers: { 'cache-control': cacheControlForSeasonPage(season) },
		})
	} catch (e) {
		console.error('[pitchArsenal]', e)
		error(502, 'Pitch arsenal unavailable')
	}
}
