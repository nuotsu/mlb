import { error } from '@sveltejs/kit'
import { cacheControlForKboGame, getKboGame, KboNotFoundError } from '#lib/server/kbo.js'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	try {
		const game = await getKboGame(params.kboGame)
		setHeaders({ 'cache-control': cacheControlForKboGame(game) })
		return { game }
	} catch (e) {
		if (e instanceof KboNotFoundError) {
			setHeaders({ 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' })
			error(404, 'Game not found')
		}
		error(502, 'Could not load the game from koreabaseball.com')
	}
}
