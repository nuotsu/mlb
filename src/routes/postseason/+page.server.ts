import { redirect } from '@sveltejs/kit'
import { getToday } from '#lib/temporal.js'

export const load = async () => {
	const season = getToday().getFullYear()

	redirect(302, `/postseason/${season}`)
}
