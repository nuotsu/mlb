import { parseFavoriteHref, type AccountUser } from '#lib/account.js'
import { analyticsEnabled } from '#lib/analytics.js'
import posthog from 'posthog-js'

/*
	Client analytics. Every custom event goes through `capture` so names and properties stay
	consistent, and nothing runs outside production.

	Quota: context that's useful on every event (signed in, color scheme) rides along as super
	properties instead of separate events, and person profiles only exist for signed-in users
	(`person_profiles: 'identified_only'`), so anonymous traffic stays on the cheaper event tier.
*/

type FavoriteProperties = {
	type: 'team' | 'player' | 'game'
	mlb_id: number
	label: string
	/** Kept from the original `favorite_added` event so older insights keep working */
	href: string
	/** Where the star was tapped: the page's route id, or `account` for the account page */
	source: string
}

type Events = {
	sign_in_started: { provider: 'google' }
	signed_in: { provider: 'google'; is_new_user: boolean; local_favorites: number }
	sign_in_failed: { provider: 'google'; error: string }
	signed_out: Record<string, never>
	favorite_added: FavoriteProperties
	favorite_removed: FavoriteProperties
	color_scheme_changed: { color_scheme: 'light' | 'dark' }
}

export function capture<E extends keyof Events>(event: E, properties: Events[E]) {
	if (analyticsEnabled) posthog.capture(event, properties)
}

/* Context: super properties, sent with every event (no extra events) */

export function setAnalyticsContext(context: {
	signed_in: boolean
	color_scheme: 'light' | 'dark'
	/** What the OS asks for, to see how many people override it */
	system_color_scheme: 'light' | 'dark'
}) {
	if (!analyticsEnabled) return
	posthog.register(context)
	updatePerson({ color_scheme: context.color_scheme })
}

/* People (signed-in users only) */

/** A user is new if the account was created just now (sign-in created it) */
const NEW_USER_WINDOW_MS = 10 * 60_000

export function isNewUser(user: AccountUser) {
	return Date.now() - new Date(user.createdAt).getTime() < NEW_USER_WINDOW_MS
}

/**
 * Tie this browser to the account. `$identify` is only sent when the distinct id changes;
 * after that, person properties go through `updatePerson`, which skips unchanged values.
 */
export function identify(user: AccountUser, colorScheme: 'light' | 'dark') {
	if (!analyticsEnabled) return

	const person = { email: user.email, name: user.name, color_scheme: colorScheme }

	if (posthog.get_distinct_id() === user.id) return updatePerson(person)

	posthog.identify(user.id, person, { signed_up_at: user.createdAt })
	writePersonCache(user.id, person)
}

/** Forget the account on this browser, so the next visitor starts anonymous */
export function resetIdentity() {
	if (!analyticsEnabled) return
	posthog.reset()
	try {
		localStorage.removeItem(PERSON_CACHE)
	} catch {}
}

/**
 * Current favorites as person properties, for "most favorited" counts that reflect what
 * people have now, not just what they once added
 */
export function setFavoriteProperties(favorites: App.Favorite[]) {
	const of = (type: FavoriteProperties['type']) =>
		favorites.flatMap((f) => {
			const key = parseFavoriteHref(f.href)
			return key?.type === type ? [{ id: key.mlbId, label: f.label }] : []
		})
	const teams = of('team')
	const players = of('player')

	updatePerson({
		favorite_team_ids: teams.map((t) => t.id),
		favorite_teams: teams.map((t) => t.label),
		favorite_player_ids: players.map((p) => p.id),
		favorite_players: players.map((p) => p.label),
		favorite_count: favorites.length,
	})
}

/*
	posthog-js only dedupes a `setPersonProperties` call against the one before it, in memory, so
	calling it on every page load would send a `$set` event each time. This remembers what was sent
	(per user, across loads) and only sends properties whose values changed.
*/

const PERSON_CACHE = 'analytics-person'

type PersonCache = { id: string; props: Record<string, unknown> }

function readPersonCache(id: string): Record<string, unknown> {
	try {
		const cache = JSON.parse(localStorage.getItem(PERSON_CACHE) ?? 'null') as PersonCache | null
		return cache?.id === id ? cache.props : {}
	} catch {
		return {}
	}
}

function writePersonCache(id: string, props: Record<string, unknown>) {
	try {
		localStorage.setItem(PERSON_CACHE, JSON.stringify({ id, props } satisfies PersonCache))
	} catch {}
}

function updatePerson(props: Record<string, unknown>) {
	if (!analyticsEnabled || !posthog._isIdentified()) return

	const id = posthog.get_distinct_id()
	const sent = readPersonCache(id)
	const changed = Object.fromEntries(
		Object.entries(props).filter(
			([key, value]) => JSON.stringify(sent[key]) !== JSON.stringify(value),
		),
	)
	if (!Object.keys(changed).length) return

	posthog.setPersonProperties(changed)
	writePersonCache(id, { ...sent, ...changed })
}

/* Events */

export function trackFavorite(
	action: 'add' | 'remove',
	favorite: App.Favorite,
	source: string,
	favorites: App.Favorite[],
) {
	const key = parseFavoriteHref(favorite.href)
	if (!key) return

	capture(action === 'add' ? 'favorite_added' : 'favorite_removed', {
		type: key.type,
		mlb_id: key.mlbId,
		label: favorite.label,
		href: favorite.href,
		source,
	})
	setFavoriteProperties(favorites)
}
