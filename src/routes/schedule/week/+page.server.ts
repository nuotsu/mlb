import { redirect } from '@sveltejs/kit'
import { formatDate, getToday } from '#lib/temporal.js'

export const load = async ({ cookies }) => {
	const tz = cookies.get('tz')
	const today = formatDate(getToday(tz), { locale: 'en-CA' })

	redirect(302, `/schedule/week/${today}`)
}
