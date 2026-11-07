import { error } from '@sveltejs/kit'
import { cacheControlForNpbGame, getNpbGame, npbGameRef } from '#lib/server/npb-game-response.js'
import { NpbNotFoundError } from '#lib/server/npb.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	try {
		const game = await getNpbGame(npbGameRef(params))
		setHeaders({ 'cache-control': cacheControlForNpbGame(game) })
		return { game }
	} catch (e) {
		if (e instanceof NpbNotFoundError) {
			setHeaders({ 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' })
			error(404, 'Game not found')
		}
		error(502, 'Could not load the game from npb.jp')
	}
}
