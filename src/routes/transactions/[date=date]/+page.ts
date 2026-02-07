import { fetchTransactions } from '$lib/fetch'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ params, url }) => {
	const searchParams = Object.fromEntries(url.searchParams.entries())

	const transactions = await fetchTransactions({
		date: params.date,
		...searchParams,
	})

	return {
		transactions,
	}
}
