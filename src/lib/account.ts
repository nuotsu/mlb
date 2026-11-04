/*
	Shared (client + server) shapes for account data. These mirror what the app keeps in
	localStorage, so the account copy and the local cache can be swapped freely.
*/

/** Kinds of favorites, from the `href` prefixes ToggleFavorite writes */
export const FAVORITE_TYPES = ['team', 'player', 'game'] as const
export type FavoriteType = (typeof FAVORITE_TYPES)[number]

const HREF_PREFIX: Record<FavoriteType, string> = {
	team: '/teams/',
	player: '/player/',
	game: '/game/',
}

export const MAX_FAVORITES = 500
export const MAX_LABEL_LENGTH = 64

export type FavoriteKey = { type: FavoriteType; mlbId: number }

/** `/teams/147` → `{ type: 'team', mlbId: 147 }`, or `null` for anything else */
export function parseFavoriteHref(href: unknown): FavoriteKey | null {
	if (typeof href !== 'string') return null
	for (const type of FAVORITE_TYPES) {
		const prefix = HREF_PREFIX[type]
		if (!href.startsWith(prefix)) continue
		const id = href.slice(prefix.length)
		if (!/^\d{1,10}$/.test(id)) return null
		const mlbId = Number(id)
		return mlbId > 0 && mlbId <= 2_147_483_647 ? { type, mlbId } : null
	}
	return null
}

export function favoriteHref({ type, mlbId }: FavoriteKey) {
	return `${HREF_PREFIX[type]}${mlbId}`
}

/** Validate an untrusted favorite (localStorage or request body) */
export function sanitizeFavorite(input: unknown): App.Favorite | null {
	if (!input || typeof input !== 'object') return null
	const { href, label } = input as Record<string, unknown>
	const key = parseFavoriteHref(href)
	if (!key || typeof label !== 'string') return null
	return { href: favoriteHref(key), label: label.slice(0, MAX_LABEL_LENGTH) }
}

/** Union by href, keeping the first occurrence (and its order) */
export function unionFavorites(...lists: App.Favorite[][]): App.Favorite[] {
	const seen = new Set<string>()
	const out: App.Favorite[] = []
	for (const list of lists) {
		for (const favorite of list) {
			if (seen.has(favorite.href)) continue
			seen.add(favorite.href)
			out.push(favorite)
		}
	}
	return out
}

/*
	Settings: device-independent preferences. Device-specific or short-lived keys
	(`sidebar-open`, `compare`, time-travel delays) intentionally stay local only.
*/

export const COLOR_SCHEMES = ['light', 'dark', 'auto'] as const
export type ColorScheme = (typeof COLOR_SCHEMES)[number]

/** App icon / favicon choices: `default` is the original, the rest live in /static/app-icons */
export const APP_ICONS = ['default', 'blue', 'green', 'red', 'black'] as const
export type AppIcon = (typeof APP_ICONS)[number]

export type Settings = {
	/** localStorage `color-scheme` */
	colorScheme?: ColorScheme
	/** localStorage `spoiler-prevention` */
	spoilerPrevention?: App.SpoilerPrevention[]
	/** localStorage `onboarding-dismissed` */
	onboardingDismissed?: string[]
	/** localStorage `app-icon` */
	appIcon?: AppIcon
}

export type AccountState = {
	favorites: App.Favorite[]
	settings: Settings
	/** Epoch ms of the last settings change, 0 if never saved */
	settingsUpdatedAt: number
}

/** Validate untrusted settings, dropping anything unexpected */
export function sanitizeSettings(input: unknown): Settings {
	if (!input || typeof input !== 'object') return {}
	const raw = input as Record<string, unknown>
	const settings: Settings = {}

	if (COLOR_SCHEMES.includes(raw.colorScheme as ColorScheme)) {
		settings.colorScheme = raw.colorScheme as ColorScheme
	}

	if (APP_ICONS.includes(raw.appIcon as AppIcon)) {
		settings.appIcon = raw.appIcon as AppIcon
	}

	if (Array.isArray(raw.spoilerPrevention)) {
		const seen = new Set<number>()
		settings.spoilerPrevention = raw.spoilerPrevention
			.filter(
				(t): t is App.SpoilerPrevention =>
					!!t &&
					Number.isInteger(t.id) &&
					t.id > 0 &&
					typeof t.abbreviation === 'string' &&
					!seen.has(t.id) &&
					!!seen.add(t.id),
			)
			.slice(0, 100)
			.map(({ id, abbreviation }) => ({ id, abbreviation: abbreviation.slice(0, 8) }))
	}

	if (Array.isArray(raw.onboardingDismissed)) {
		settings.onboardingDismissed = [
			...new Set(
				raw.onboardingDismissed.filter(
					(id): id is string => typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id),
				),
			),
		].slice(0, 50)
	}

	return settings
}

/**
 * Merge local data into the account on sign-in:
 * favorites are unioned, settings come from whichever side changed last (newest wins), with
 * keys the winner never set filled in from the other side. An account that has never saved
 * settings always takes the local ones.
 */
export function mergeAccountState(
	account: AccountState,
	local: AccountState,
	now = Date.now(),
): AccountState {
	const localNewer =
		account.settingsUpdatedAt === 0 || local.settingsUpdatedAt > account.settingsUpdatedAt

	return {
		favorites: unionFavorites(account.favorites, local.favorites).slice(0, MAX_FAVORITES),
		settings: localNewer
			? { ...account.settings, ...local.settings }
			: { ...local.settings, ...account.settings },
		settingsUpdatedAt: localNewer ? local.settingsUpdatedAt || now : account.settingsUpdatedAt,
	}
}

/** The bits of the signed-in user the client sees */
export type AccountUser = {
	id: string
	name: string
	email: string
	image: string | null
	/** ISO date the account was created */
	createdAt: string
}

/** One signed-in device, as shown in the account menu (never includes the session token) */
export type AccountSession = {
	id: string
	kind: import('./user-agent.js').DeviceKind
	label: string
	/** ISO date of the last session refresh (Better Auth updates it at most daily) */
	lastActive: string
	current: boolean
}
