import { cacheControlForGame, getScheduleToday } from '#lib/cache-control.js'
import type { NpbGameRef } from '#lib/npb-game.js'
import { getNpbGame, isRecentNpbGame, type NpbGameData } from '#lib/server/npb.js'

/** The page and API share one cache policy: a past game's page won't change */
export function cacheControlForNpbGame(game: NpbGameData) {
	if (!isRecentNpbGame(game.ref, getScheduleToday())) return cacheControlForGame('Final')
	// npb.jp updates a live game every half minute or so, and a finished one can still be corrected
	if (game.state === 'Final') return 'public, s-maxage=300, stale-while-revalidate=3600'
	if (game.state === 'Live') return 'public, s-maxage=30, stale-while-revalidate=60'
	return cacheControlForGame('Preview')
}

export function npbGameRef(params: {
	season: string
	npbDate: string
	npbGame: string
}): NpbGameRef {
	return { season: Number(params.season), date: params.npbDate, code: params.npbGame }
}

export { getNpbGame }
