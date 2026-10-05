import { cacheControlForSeasonPage } from '#lib/cache-control.js'
import {
	ABS_CHALLENGER_TYPES,
	fetchAbsChallengers,
	type AbsChallengerType,
} from '#lib/fetch/savant.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, url, fetch, setHeaders }) => {
	setHeaders({ 'cache-control': cacheControlForSeasonPage(params.season) })

	const requestedType = url.searchParams.get('type') as AbsChallengerType
	const challengerType = ABS_CHALLENGER_TYPES.includes(requestedType) ? requestedType : 'batter'
	const gameType = url.searchParams.get('gameType') ?? 'R'

	/** A Savant outage leaves the page standing — the table says so instead. */
	const challengers = await fetchAbsChallengers(
		{ season: params.season, challengerType, gameType },
		{ fetch },
	).catch((e) => {
		console.error('[abs]', e)
		return null
	})

	return {
		challengerType,
		challengers: challengers ?? [],
		unavailable: !challengers,
	}
}
