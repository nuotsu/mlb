import {
	BETTER_AUTH_SECRET,
	BETTER_AUTH_URL,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	OAUTH_PROXY_SECRET,
	VERCEL_BRANCH_URL,
	VERCEL_URL,
} from '$app/env/private'
import { VERCEL_ENV } from '$app/env/public'
import { getRequestEvent } from '$app/server'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { oAuthProxy } from 'better-auth/plugins'
import { sveltekitCookies } from 'better-auth/svelte-kit'
import { dbEnabled, getDb, schema } from './db/index.js'

/** Accounts need a database, a secret, and Google credentials; otherwise the app is signed-out only */
export const authEnabled =
	dbEnabled && !!BETTER_AUTH_SECRET && !!GOOGLE_CLIENT_ID && !!GOOGLE_CLIENT_SECRET

/** Google only allows exact redirect URIs, so previews sign in through production */
export const PRODUCTION_URL = 'https://mlb.theohtani.com'

/*
	Base URL: `BETTER_AUTH_URL` when set (production, local). On Vercel previews, leave it unset:
	the request host is used if it's this deployment's branch or deployment URL (anything else is
	rejected). Google still only sees the production callback, via the OAuth proxy below.
*/
function baseURL(): BetterAuthOptions['baseURL'] {
	if (BETTER_AUTH_URL) return BETTER_AUTH_URL

	const hosts = [VERCEL_BRANCH_URL, VERCEL_URL].filter((h): h is string => !!h)
	if (!hosts.length) return undefined // dev: inferred from the request

	return {
		allowedHosts: hosts,
		fallback: `https://${hosts[0]}`,
		protocol: 'https',
	}
}

function createAuth() {
	return betterAuth({
		appName: 'MLB.TheOhtani.com',
		secret: BETTER_AUTH_SECRET,
		baseURL: baseURL(),
		database: drizzleAdapter(getDb(), {
			provider: 'pg',
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification,
			},
		}),
		emailAndPassword: { enabled: false },
		socialProviders: {
			google: {
				clientId: GOOGLE_CLIENT_ID!,
				clientSecret: GOOGLE_CLIENT_SECRET!,
				prompt: 'select_account',
			},
		},
		session: {
			expiresIn: 60 * 60 * 24 * 30, // 30 days
			updateAge: 60 * 60 * 24, // refresh expiry at most daily
			// Signed session cache in a cookie, so most requests skip the database
			cookieCache: { enabled: true, maxAge: 5 * 60 },
		},
		advanced: {
			// httpOnly + SameSite=Lax always; Secure whenever the base URL is https
			defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
		},
		telemetry: { enabled: false },
		plugins: [
			/*
				OAuth proxy: a preview sends Google back to the production callback, production
				exchanges the code and hands the encrypted profile to the preview, which creates the
				session in its own database. Production and previews must share OAUTH_PROXY_SECRET
				(or BETTER_AUTH_SECRET).

				A preview with its own `BETTER_AUTH_URL` (its branch URL, registered as a Google
				redirect URI) signs in directly instead, so it works before production has this code.
				Off locally, where localhost is registered.
			*/
			...(VERCEL_ENV === 'production' || (VERCEL_ENV === 'preview' && !BETTER_AUTH_URL)
				? [
						oAuthProxy({
							productionURL: PRODUCTION_URL,
							// Comes back to whichever allowed preview host (branch or deployment URL) started it
							secret: OAUTH_PROXY_SECRET || undefined,
						}),
					]
				: []),
			// Must be last: forwards Set-Cookie from server-side `auth.api` calls to SvelteKit
			sveltekitCookies(getRequestEvent),
		],
	})
}

export type Auth = ReturnType<typeof createAuth>

let auth: Auth | undefined

/** The Better Auth instance, created on first use (only call when `authEnabled`) */
export function getAuth(): Auth {
	if (!authEnabled) throw new Error('Auth is not configured')
	return (auth ??= createAuth())
}

export type SessionUser = Auth['$Infer']['Session']['user']
export type Session = Auth['$Infer']['Session']['session']
