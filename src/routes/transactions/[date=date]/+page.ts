import { cacheControlForScheduleDay } from '$lib/cache-control'
import { fetchWeekTransactions } from '$lib/fetch/presets'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url, setHeaders }) => {
	setHeaders({ 'cache-control': cacheControlForScheduleDay(params.date) })

	const searchParams = Object.fromEntries(url.searchParams.entries())

	const transactions = await fetchWeekTransactions({
		date: params.date,
		...searchParams,
	})

	return {
		transactions,
	}
}
