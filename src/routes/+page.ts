import { fetchMLB, fetchSeason } from '$lib/fetch'
import { formatDate, getToday } from '$lib/temporal'
import type { PageLoad } from './$types'

export const load: PageLoad = async () => {
	const year = getToday().getFullYear().toString()

	const [season, transactions] = await Promise.all([
		fetchSeason(year),
		fetchMLB<MLB.TransactionsResponse>('/api/v1/transactions', {
			sportId: '1',
			date: formatDate(getToday(), { locale: 'en-CA' }),
			fields: ['transactions,date,description,typeDesc,toTeam,fromTeam,id,name,fullName,person'],
		}),
	])

	return {
		season,
		transactions,
	}
}
