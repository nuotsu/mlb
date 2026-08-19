import { fetchLongestHomeRuns } from '$lib/fetch/savant'
import type { PageServerLoad } from './$types'

/**
 * Streamed so the leader tables paint without waiting on Statcast, which lives
 * on a separate host and can be slow. Failures resolve to `null` so the section
 * degrades instead of erroring the page.
 */
export const load: PageServerLoad = ({ params, url, fetch }) => {
	const gameType = url.searchParams.get('gameType') ?? 'R'
	const sportId = url.searchParams.get('sportId') ?? '1'

	return {
		// Statcast only covers MLB
		longestHomeRuns:
			sportId === '1'
				? fetchLongestHomeRuns({ season: params.season, gameType }, { fetch }).catch((e) => {
						console.error('[longestHomeRuns]', e)
						return null
					})
				: Promise.resolve(null),
	}
}
