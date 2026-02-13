import { fetchMLB } from '$lib/fetch'
import { formatDate, getToday } from '$lib/temporal'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
	const year = getToday().getFullYear().toString()

	const [seasons, transactions] = await Promise.all([
		fetchMLB<MLB.SeasonResponse>(`/api/v1/seasons`, {
			sportId: '1',
			season: year,
		}),
		fetchMLB<MLB.TransactionsResponse>('/api/v1/transactions', {
			sportId: '1',
			date: formatDate(getToday(), { locale: 'en-CA' }),
			fields: ['transactions,date,description,typeDesc,toTeam,fromTeam,id,name,person'],
		}),
	])

	return {
		season: seasons.seasons[0],
		transactions,
	}
}
