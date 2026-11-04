import { authEnabled } from '#lib/server/auth.js'
import { BETTER_AUTH_URL } from '$app/env/private'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ locals }) => {
	const { user } = locals

	return {
		/** Whether sign-in is available (same for every visitor, so safe in cached HTML) */
		accounts: authEnabled,
		/**
		 * The one origin Google redirects back to, when it's fixed (`BETTER_AUTH_URL`). Sign-in
		 * started on another host (a per-commit preview URL, 127.0.0.1) hops here first.
		 */
		authOrigin: authEnabled && BETTER_AUTH_URL ? new URL(BETTER_AUTH_URL).origin : null,
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
