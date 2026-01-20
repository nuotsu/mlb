import { redirect } from '@sveltejs/kit'
import { formatDate, getToday } from '$lib/temporal'

export const load = async () => {
	const today = formatDate(getToday(), { locale: 'en-CA' })

	redirect(302, `/schedule/week/${today}`)
}
