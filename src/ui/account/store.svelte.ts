import type { AccountSession, AccountState, AccountUser, Settings } from '#lib/account.js'
import { authClient } from '#lib/auth-client.js'
import { appIconStore } from '#ui/app-icon/store.svelte.js'
import { favoritesStore } from '#ui/favorites/store.svelte.js'
import { onboardingStore } from '#ui/onboarding/store.svelte.js'
import { spoilerPreventionStore } from '#ui/spoiler-prevention/store.svelte.js'
import { colorSchemeStore } from '#ui/store.svelte.js'
import { browser } from '$app/env'
import {
	getSettingsUpdatedAt,
	setAccountListener,
	setSettingsUpdatedAt,
	type AccountListener,
} from './changes.js'

/*
	Account sync. Components keep using the existing local stores (favoritesStore, etc.);
	localStorage is always the cache they read from.

	- Signed out: localStorage is the source of truth. Nothing here runs network requests.
	- On sign-in: local data is merged into the account (union favorites, newest settings win),
	  and the merged result is written back to the local stores.
	- Signed in: the account is the source of truth. Each page load pulls it into the cache,
	  and local changes are pushed as they happen.
	- On sign-out: local stores keep the last synced data and become the source of truth again.
*/

/** Id of the user whose account data is mirrored in localStorage */
const SYNCED_USER = 'account-user'
/** Set before redirecting to Google, so we check the session on return even if the HTML was cached */
const AUTH_PENDING = 'auth-pending'
/** URL hash that resumes sign-in after hopping to the auth origin */
const SIGN_IN_HASH = '#sign-in'

/** Origin Google redirects back to, when fixed; sign-in elsewhere hops there first */
let authOrigin: string | null = null

export const accountStore = $state({
	/** Accounts are configured on the server */
	enabled: false,
	user: null as AccountUser | null,
	status: 'idle' as 'idle' | 'syncing' | 'synced' | 'error',

	async signIn() {
		// Google only knows one callback host: continue on that host, on the same page
		if (authOrigin && authOrigin !== location.origin) {
			location.assign(authOrigin + location.pathname + location.search + SIGN_IN_HASH)
			return
		}

		localStorage.setItem(AUTH_PENDING, String(Date.now()))
		const { error } = await authClient.signIn.social({
			provider: 'google',
			callbackURL: location.pathname + location.search,
		})
		if (error) {
			localStorage.removeItem(AUTH_PENDING)
			console.error('[account] sign-in failed', error)
		}
	},

	async signOut() {
		disconnect()
		this.user = null
		await authClient.signOut().catch((error) => console.error('[account] sign-out failed', error))
	},

	/** Signed-in devices, current one first (fetched on demand) */
	listSessions() {
		return send<AccountSession[]>('/api/account/sessions', 'GET')
	},

	/** Sign out every other device; returns what's left */
	revokeOtherSessions() {
		return send<AccountSession[]>('/api/account/sessions', 'DELETE', {})
	},
})

let initialized = false

/** Call once in the browser with the root layout data */
export function initAccount(data: {
	accounts?: boolean
	authOrigin?: string | null
	user?: AccountUser | null
}) {
	if (!browser || initialized) return
	initialized = true

	accountStore.enabled = !!data.accounts
	authOrigin = data.authOrigin ?? null
	if (!accountStore.enabled) return disconnect()

	if (data.user) return connect(data.user)

	// Arrived from another host to finish starting sign-in
	if (location.hash === SIGN_IN_HASH) {
		history.replaceState(history.state, '', location.pathname + location.search)
		if (location.origin === authOrigin) {
			accountStore.signIn()
			return
		}
	}

	// The server saw no session, but this page may have come from the CDN cache. Only ask
	// when there's reason to believe we're signed in, so signed-out visits stay request-free.
	const pending = Number(localStorage.getItem(AUTH_PENDING)) > Date.now() - 10 * 60_000
	if (!pending && !localStorage.getItem(SYNCED_USER)) return

	authClient
		.getSession()
		.then(({ data: session }) => {
			if (session?.user) {
				connect({
					id: session.user.id,
					name: session.user.name,
					email: session.user.email,
					image: session.user.image ?? null,
					createdAt: new Date(session.user.createdAt).toISOString(),
				})
			} else {
				disconnect()
			}
		})
		.catch(() => {})
}

/* Pushes */

let pendingFavorites: Parameters<AccountListener['favorite']>[] = []
let settingsTimer: ReturnType<typeof setTimeout> | undefined

const queueListener: AccountListener = {
	// Changes made while the initial sync is in flight are replayed once it lands
	favorite: (...args) => pendingFavorites.push(args),
	settings: () => {},
}

const pushListener: AccountListener = {
	favorite(action, favorite) {
		send('/api/account/favorites', action === 'add' ? 'PUT' : 'DELETE', favorite)
	},
	settings() {
		clearTimeout(settingsTimer)
		settingsTimer = setTimeout(async () => {
			const state = await send<AccountState>('/api/account/preferences', 'PUT', {
				settings: localSettings(),
				updatedAt: getSettingsUpdatedAt(),
			})
			// Another device saved newer settings: take them
			if (state && state.settingsUpdatedAt > getSettingsUpdatedAt()) applySettings(state)
		}, 300)
	},
}

async function connect(user: AccountUser) {
	accountStore.user = user
	accountStore.status = 'syncing'
	localStorage.removeItem(AUTH_PENDING)
	setAccountListener(queueListener)

	// Same user as last time: the account is the truth. New sign-in: merge local data in.
	const state =
		localStorage.getItem(SYNCED_USER) === user.id
			? await send<AccountState>('/api/account', 'GET')
			: await send<AccountState>('/api/account/sync', 'POST', localState())

	if (accountStore.user?.id !== user.id) return // signed out meanwhile

	if (!state) {
		// Keep working from the cache; local changes stay local until the next load
		accountStore.status = 'error'
		setAccountListener(null)
		return
	}

	favoritesStore._replace(state.favorites)
	applySettings(state)
	localStorage.setItem(SYNCED_USER, user.id)
	accountStore.status = 'synced'

	setAccountListener(pushListener)
	for (const [action, favorite] of pendingFavorites.splice(0)) {
		if (action === 'add') favoritesStore.add(favorite)
		else favoritesStore.remove(favorite)
	}
}

function disconnect() {
	setAccountListener(null)
	clearTimeout(settingsTimer)
	pendingFavorites = []
	accountStore.status = 'idle'
	if (browser) {
		localStorage.removeItem(SYNCED_USER)
		localStorage.removeItem(AUTH_PENDING)
	}
}

/* Local snapshot / apply */

function localSettings(): Settings {
	const { colorScheme } = colorSchemeStore
	return {
		colorScheme: colorScheme === 'light' || colorScheme === 'dark' ? colorScheme : 'auto',
		spoilerPrevention: $state.snapshot(spoilerPreventionStore.teams),
		onboardingDismissed: $state.snapshot(onboardingStore.dismissed),
		appIcon: appIconStore.icon,
	}
}

function localState(): AccountState {
	return {
		favorites: $state.snapshot(favoritesStore.favorites),
		settings: localSettings(),
		settingsUpdatedAt: getSettingsUpdatedAt(),
	}
}

function applySettings({ settings, settingsUpdatedAt }: AccountState) {
	if (settings.colorScheme && settings.colorScheme !== 'auto') {
		colorSchemeStore.colorScheme = settings.colorScheme
		localStorage.setItem('color-scheme', settings.colorScheme)
	}
	if (settings.spoilerPrevention) spoilerPreventionStore._replace(settings.spoilerPrevention)
	if (settings.onboardingDismissed) onboardingStore._replace(settings.onboardingDismissed)
	if (settings.appIcon) appIconStore._replace(settings.appIcon)
	setSettingsUpdatedAt(settingsUpdatedAt)
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T | null> {
	try {
		const response = await fetch(url, {
			method,
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body),
			credentials: 'same-origin',
		})
		if (response.status === 401) {
			// Session ended elsewhere: fall back to local
			disconnect()
			accountStore.user = null
			return null
		}
		if (!response.ok) throw new Error(`${method} ${url}: ${response.status}`)
		return response.status === 204 ? (null as T) : ((await response.json()) as T)
	} catch (error) {
		console.error('[account]', error)
		return null
	}
}
