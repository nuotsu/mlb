import { sanitizeHome, type HomeSettings } from './home.js'
import { DELAY_TTL_MS } from './time-travel.js'

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
	Settings: device-independent preferences. Device-specific keys (`sidebar-open`) stay local
	only. Time-travel moments sync too, but separately (see `TimeTravel` below).
*/

export const COLOR_SCHEMES = ['light', 'dark', 'auto'] as const
export type ColorScheme = (typeof COLOR_SCHEMES)[number]

/**
 * App icon / favicon choices, in picker order. `default` is the original (listed last); the rest
 * live in /static/app-icons
 */
export const APP_ICONS = ['blue', 'green', 'red', 'black', 'default'] as const
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
	/** localStorage `compare`: player ids, in order */
	compare?: number[]
	/** localStorage `home`: the home page's widget layout */
	home?: HomeSettings
}

export const MAX_COMPARE = 20

/*
	Time travel: the moment on screen per game (localStorage `time-travel:<gamePk>`), so a game
	watched behind live on one device resumes at the same pitch on another. Moments are short-lived
	and refreshed every few seconds while watching, so they don't go through the settings'
	"newest wins" stamp (that would overwrite settings changed on other devices); each game's
	moment is merged on its own, newest `savedAt` wins.
*/

export type TimeTravelMoment = {
	/** Epoch ms of the moment on screen */
	at: number
	/** Epoch ms it was saved */
	savedAt: number
}

/** Moments by gamePk */
export type TimeTravel = Record<string, TimeTravelMoment>

export const MAX_TIME_TRAVEL = 50

/** Validate an untrusted moment, or `null` if it's unusable or expired */
export function sanitizeMoment(input: unknown, now = Date.now()): TimeTravelMoment | null {
	if (!input || typeof input !== 'object') return null
	const { at, savedAt } = input as Record<string, unknown>
	if (typeof at !== 'number' || typeof savedAt !== 'number') return null
	if (!Number.isFinite(at) || !Number.isFinite(savedAt) || at <= 0 || at > savedAt) return null
	if (!(now - savedAt < DELAY_TTL_MS)) return null
	// Clamp client clocks: never in the future
	const clamped = Math.min(savedAt, now)
	return { at: Math.min(at, clamped), savedAt: clamped }
}

export function isGamePk(input: unknown): input is string {
	return typeof input === 'string' && /^[1-9]\d{0,9}$/.test(input)
}

/** Validate untrusted moments, dropping expired ones and keeping the newest few */
export function sanitizeTimeTravel(input: unknown, now = Date.now()): TimeTravel {
	if (!input || typeof input !== 'object') return {}
	const entries = Object.entries(input as Record<string, unknown>).flatMap(([gamePk, raw]) => {
		const moment = isGamePk(gamePk) ? sanitizeMoment(raw, now) : null
		return moment ? [[gamePk, moment] as const] : []
	})
	return Object.fromEntries(
		entries.sort(([, a], [, b]) => b.savedAt - a.savedAt).slice(0, MAX_TIME_TRAVEL),
	)
}

/** Per game, the newest moment wins */
export function mergeTimeTravel(a: TimeTravel, b: TimeTravel): TimeTravel {
	const out: TimeTravel = { ...a }
	for (const [gamePk, moment] of Object.entries(b)) {
		if (!out[gamePk] || moment.savedAt > out[gamePk].savedAt) out[gamePk] = moment
	}
	return out
}

export type AccountState = {
	favorites: App.Favorite[]
	settings: Settings
	/** Epoch ms of the last settings change, 0 if never saved */
	settingsUpdatedAt: number
	timeTravel: TimeTravel
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

	if (Array.isArray(raw.compare)) {
		settings.compare = [
			...new Set(
				raw.compare.filter(
					(id): id is number => Number.isInteger(id) && id > 0 && id <= 2_147_483_647,
				),
			),
		].slice(0, MAX_COMPARE)
	}

	const home = sanitizeHome(raw.home)
	if (home) settings.home = home

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
 * favorites are unioned, and the account's saved settings win, so signing in always loads what
 * the account has (app icon, color scheme, etc.) rather than whatever this device last used.
 * Local settings only fill keys the account never set, and dismissed hints are unioned. An
 * account that has never saved settings takes the local ones. Time-travel moments merge per
 * game, newest wins.
 */
export function mergeAccountState(
	account: AccountState,
	local: AccountState,
	now = Date.now(),
): AccountState {
	const favorites = unionFavorites(account.favorites, local.favorites).slice(0, MAX_FAVORITES)
	const timeTravel = sanitizeTimeTravel(mergeTimeTravel(account.timeTravel, local.timeTravel), now)

	if (account.settingsUpdatedAt === 0) {
		return {
			favorites,
			settings: { ...account.settings, ...local.settings },
			settingsUpdatedAt: local.settingsUpdatedAt || now,
			timeTravel,
		}
	}

	const settings: Settings = { ...local.settings, ...account.settings }
	if (account.settings.onboardingDismissed || local.settings.onboardingDismissed) {
		settings.onboardingDismissed = [
			...new Set([
				...(account.settings.onboardingDismissed ?? []),
				...(local.settings.onboardingDismissed ?? []),
			]),
		].slice(0, 50)
	}

	// Stamp anything local added so it's saved, otherwise keep the account's stamp
	const changed = (Object.keys(settings) as (keyof Settings)[]).some(
		(key) => JSON.stringify(settings[key]) !== JSON.stringify(account.settings[key]),
	)
	return {
		favorites,
		settings,
		settingsUpdatedAt: changed ? now : account.settingsUpdatedAt,
		timeTravel,
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
