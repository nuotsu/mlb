import { fetchMLB } from '#lib/fetch/index.js'
import { fetchSeason } from '#lib/fetch/presets.js'
import { seasonPhase } from '#lib/home.js'
import { formatDate, getToday } from '#lib/temporal.js'
import { getAllBlogs } from '#ui/blog/get-blog.js'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600' })

	const today = getToday()
	const year = today.getFullYear()
	const date = formatDate(today, { locale: 'en-CA' })

	const [seasonResult, transactionsResult] = await Promise.allSettled([
		fetchSeason(String(year)),
		fetchMLB<MLB.TransactionsResponse>(
			'/api/v1/transactions',
			{
				sportId: '1',
				date,
				fields: ['transactions,date,description,typeDesc,toTeam,fromTeam,id,name,fullName,person'],
			},
			{ fetch },
		),
	])

	const current = seasonResult.status === 'fulfilled' ? (seasonResult.value ?? null) : null

	// After the World Series, look ahead: next season's dates drive the countdowns
	const over = !!current?.postSeasonEndDate && date > current.postSeasonEndDate
	const season = over
		? ((await fetchSeason(String(year + 1)).catch(() => undefined)) ?? current)
		: current

	return {
		season,
		phase: seasonPhase(season, date),
		/** Last season's final standings until this one's regular season starts */
		standingsSeason: String(
			current?.regularSeasonStartDate && date >= current.regularSeasonStartDate ? year : year - 1,
		),
		transactions: transactionsResult.status === 'fulfilled' ? transactionsResult.value : null,
		posts: getAllBlogs(),
	}
}
