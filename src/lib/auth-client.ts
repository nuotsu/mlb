import { createAuthClient } from 'better-auth/svelte'

/** Better Auth client. Same origin, so no `baseURL` needed (works on every preview URL). */
export const authClient = createAuthClient()
