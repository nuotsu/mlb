import { playgroundAction } from '$ui/playground/action'
import type { Actions } from './$types'

export const actions = {
	default: async ({ request }) => playgroundAction({ request }),
} satisfies Actions
