import { error } from '@sveltejs/kit'
import { fetchUmpScorecard } from '#lib/fetch/umpscorecards.js'
import type { RequestHandler } from './$types'

/**
 * UmpScorecards isn't CORS-enabled, so the server looks up the home plate
 * umpire's scorecard for the game and their season to date.
 */
export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const date = url.searchParams.get('date') ?? ''
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) error(400, 'Invalid date')

	const umpire = url.searchParams.get('umpire')?.slice(0, 100) || undefined

	const scorecard = await fetchUmpScorecard(
		{ gamePk: Number(params.gamePk), date, umpire },
		{ fetch },
	)

	return Response.json(scorecard, {
		headers: {
			// Scorecards post the morning after a game; once one exists it won't change
			'cache-control': scorecard.game
				? 'public, s-maxage=86400, stale-while-revalidate=604800'
				: 'public, s-maxage=1800, stale-while-revalidate=3600',
		},
	})
}
