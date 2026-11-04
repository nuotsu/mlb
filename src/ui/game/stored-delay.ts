import { delayStorageKey, writeStoredDelay } from '#lib/time-travel.js'
import { momentChanged } from '#ui/account/changes.js'

/**
 * `writeStoredDelay` on localStorage, reporting the change so a signed-in account keeps the
 * moment too (and other devices resume there)
 */
export function saveStoredDelay(gamePk: string | number, ms: number | null, now = Date.now()) {
	const key = delayStorageKey(gamePk)
	let had: boolean
	try {
		had = localStorage.getItem(key) != null
	} catch {
		return
	}

	writeStoredDelay(localStorage, gamePk, ms, now)

	// Live pages clear the delay on every visit; only a moment that existed is news
	if (ms == null) {
		if (had) momentChanged(gamePk, null)
	} else {
		momentChanged(gamePk, { at: now - ms, savedAt: now })
	}
}
