import { authEnabled } from '#lib/server/auth.js'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals }) => {
	const { user } = locals

	return {
		/** Whether sign-in is available (same for every visitor, so safe in cached HTML) */
		accounts: authEnabled,
		user: user
			? {
					id: user.id,
					name: user.name,
					email: user.email,
					image: user.image ?? null,
					createdAt: new Date(user.createdAt).toISOString(),
				}
			: null,
	}
}
