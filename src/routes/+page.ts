import { fetchMLB } from '$lib/fetch'
import { fetchSeason } from '$lib/fetch/presets'
import { formatDate, getToday } from '$lib/temporal'
import { getAllBlogs } from '$ui/blog/get-blog'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ fetch, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600' })

	const year = getToday().getFullYear().toString()

	const [seasonResult, transactionsResult] = await Promise.allSettled([
		fetchSeason(year),
		fetchMLB<MLB.TransactionsResponse>(
			'/api/v1/transactions',
			{
				sportId: '1',
				date: formatDate(getToday(), { locale: 'en-CA' }),
				fields: ['transactions,date,description,typeDesc,toTeam,fromTeam,id,name,fullName,person'],
			},
			{ fetch },
		),
	])

	const posts = getAllBlogs()

	return {
		season: seasonResult.status === 'fulfilled' ? seasonResult.value : null,
		transactions: transactionsResult.status === 'fulfilled' ? transactionsResult.value : null,
		posts,
	}
}
