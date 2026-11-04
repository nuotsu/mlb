import type { TimeTravelMoment } from '#lib/account.js'
import { browser } from '$app/env'

/*
	Local stores report changes here; the account sync module (when signed in) listens and
	pushes them to the server. Stores stay unaware of whether anyone is signed in.
*/

const SETTINGS_UPDATED_AT = 'settings-updated-at'

export type AccountListener = {
	favorite(action: 'add' | 'remove', favorite: App.Favorite): void
	settings(): void
	/** A game's time-travel moment was saved, or forgotten with `null` */
	moment(gamePk: string, moment: TimeTravelMoment | null): void
}

let listener: AccountListener | null = null

export function setAccountListener(next: AccountListener | null) {
	listener = next
}

export function favoriteChanged(action: 'add' | 'remove', favorite: App.Favorite) {
	listener?.favorite(action, favorite)
}

export function momentChanged(gamePk: string | number, moment: TimeTravelMoment | null) {
	listener?.moment(String(gamePk), moment)
}

/** Call after any synced setting changes locally (stamps it for "newest wins") */
export function settingsChanged() {
	setSettingsUpdatedAt(Date.now())
	listener?.settings()
}

export function getSettingsUpdatedAt() {
	if (!browser) return 0
	return Number(localStorage.getItem(SETTINGS_UPDATED_AT)) || 0
}

export function setSettingsUpdatedAt(at: number) {
	if (browser) localStorage.setItem(SETTINGS_UPDATED_AT, String(at))
}
