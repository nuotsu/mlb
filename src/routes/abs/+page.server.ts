import { redirect } from '@sveltejs/kit'
import { getToday } from '#lib/temporal.js'

export const load = async ({ url }) => {
	const season = getToday().getFullYear()

	redirect(302, `/abs/${season}${url.search}`)
}
