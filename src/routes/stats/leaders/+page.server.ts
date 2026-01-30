import { redirect } from '@sveltejs/kit'
import { getToday } from '$lib/temporal'

export const load = async () => {
	const season = getToday().getFullYear()

	redirect(302, `/stats/leaders/${season}`)
}
