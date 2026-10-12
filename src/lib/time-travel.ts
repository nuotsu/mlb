/**
 * Time travel: show a game as it stood `delay` ms ago, so the page can trail a TV
 * broadcast or stream. The Stats API serves the whole feed as of any moment via
 * `?timecode=YYYYMMDD_HHMMSS` (UTC), returning the latest snapshot at or before it.
 */

/** Query param holding the delay, in whole seconds */
export const DELAY_PARAM = 'delay'

/** The Stats API's `YYYYMMDD_HHMMSS` timecode (UTC) for a moment, floored to the second */
export function toTimecode(ms: number) {
	const iso = new Date(ms).toISOString() // 2026-10-09T00:08:51.917Z
	return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}_${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}`
}

/** A `?delay=` value in seconds → ms, or `null` for live */
export function parseDelay(value: string | null | undefined) {
	if (!value) return null
	const seconds = Math.floor(Number(value))
	return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null
}

/**
 * A delay is saved per game, so following a link away and coming back keeps the page in
 * sync with the stream. It's forgotten once it goes this long without being looked at.
 */
export const DELAY_TTL_MS = 6 * 60 * 60 * 1000

type DelayStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function delayStorageKey(gamePk: string | number) {
	return `time-travel:${gamePk}`
}

/** The saved delay for a game in ms, or `null`; an expired one is cleared */
export function readStoredDelay(storage: DelayStorage, gamePk: string | number, now = Date.now()) {
	try {
		const key = delayStorageKey(gamePk)
		const saved = JSON.parse(storage.getItem(key) ?? 'null') as {
			delay?: number
			savedAt?: number
		} | null
		if (!saved) return null
		if (!(now - (saved.savedAt ?? 0) < DELAY_TTL_MS)) {
			storage.removeItem(key)
			return null
		}
		return parseDelay(String(saved.delay))
	} catch {
		return null
	}
}

/** Save a game's delay (ms), or forget it with `null` */
export function writeStoredDelay(
	storage: DelayStorage,
	gamePk: string | number,
	ms: number | null,
	now = Date.now(),
) {
	try {
		const key = delayStorageKey(gamePk)
		if (ms == null) storage.removeItem(key)
		else storage.setItem(key, JSON.stringify({ delay: Math.round(ms / 1000), savedAt: now }))
	} catch {
		// Storage can be full or blocked; the URL still carries the delay
	}
}

/**
 * An inline `<head>` script for a full page load of a game with a saved delay: it puts
 * `?delay=` on the address and reloads before anything paints, so the server renders
 * the delayed moment instead of flashing the live one. Mirrors `readStoredDelay`.
 */
export function restoreDelayScript(gamePk: string | number) {
	const key = JSON.stringify(delayStorageKey(gamePk))
	return `(()=>{try{const k=${key},s=JSON.parse(localStorage.getItem(k)||'null');if(!s)return;if(!(Date.now()-(s.savedAt||0)<${DELAY_TTL_MS})){localStorage.removeItem(k);return}const d=Math.floor(Number(s.delay));if(!(d>0))return;const u=new URL(location.href);if(u.searchParams.has(${JSON.stringify(DELAY_PARAM)}))return;u.searchParams.set(${JSON.stringify(DELAY_PARAM)},String(d));location.replace(u.href)}catch{}})()`
}

/**
 * The delay that lands "now − delay" on `startTime`, in whole seconds. Rounding down
 * keeps the target at or after the moment, so its snapshot already holds that event.
 */
export function delaySince(startTime: string, now = Date.now()) {
	return Math.max(0, Math.floor((now - Date.parse(startTime)) / 1000)) * 1000
}

export type TimelinePitch = {
	/** The pitch's `playEvent.startTime`, also its option value */
	startTime: string
	/** The pitcher's running pitch count, this pitch included */
	number: number
}

export type TimelinePitcher = {
	id: number
	fullName: string
	lastName: string
	pitches: TimelinePitch[]
}

/**
 * Every pitch so far, grouped by pitcher in the order they took the mound (both teams).
 * Carries nothing but names and pitch numbers, so the list itself can't spoil a play.
 */
export function pitchTimeline(
	plays: MLB.Play[] | undefined,
	players?: Record<string, Pick<MLB.Person, 'fullName' | 'lastName'>>,
) {
	const pitchers = new Map<number, TimelinePitcher>()
	/** Who's on the mound for each fielding side, carried across plate appearances */
	const onMound: Partial<Record<'away' | 'home', number>> = {}

	function pitcher(id: number, person?: Partial<MLB.Person>) {
		let entry = pitchers.get(id)
		if (!entry) {
			const known = players?.[`ID${id}`] ?? person
			entry = {
				id,
				fullName: known?.fullName ?? person?.fullName ?? `#${id}`,
				lastName: known?.lastName ?? person?.lastName ?? known?.fullName ?? `#${id}`,
				pitches: [],
			}
			pitchers.set(id, entry)
		}
		return entry
	}

	for (const play of plays ?? []) {
		const side = play.about?.isTopInning ? 'home' : 'away'
		const matchupPitcher = play.matchup?.pitcher
		const events = play.playEvents ?? []
		const changesMidPlay = events.some((e) => e.details?.eventType === 'pitching_substitution')

		// A pitching change lands inside the plate appearance it interrupts (or precedes),
		// so pitches before it belong to whoever was already pitching
		let current = changesMidPlay ? (onMound[side] ?? matchupPitcher?.id) : matchupPitcher?.id

		for (const event of events) {
			if (event.details?.eventType === 'pitching_substitution' && event.player?.id) {
				current = event.player.id
				continue
			}
			if (!event.isPitch || !event.startTime || current == null) continue

			const entry = pitcher(current, current === matchupPitcher?.id ? matchupPitcher : undefined)
			entry.pitches.push({ startTime: event.startTime, number: entry.pitches.length + 1 })
		}

		if (matchupPitcher?.id) onMound[side] = matchupPitcher.id
	}

	return [...pitchers.values()]
}

/** Every pitch's start time, oldest first */
export function pitchStartTimes(plays: MLB.Play[] | undefined) {
	return (plays ?? [])
		.flatMap((play) => play.playEvents ?? [])
		.flatMap((event) => (event.isPitch && event.startTime ? [event.startTime] : []))
		.sort()
}

/**
 * The pitch one step before or after `from` in `times` (oldest first). Without `from`
 * (before the first pitch), stepping forward lands on the first pitch.
 */
export function adjacentPitch(times: string[], from: string | undefined, step: -1 | 1) {
	if (step === 1) return times.find((time) => from == null || time > from)
	if (from == null) return undefined
	return times.findLast((time) => time < from)
}

/** The most recent pitch in the timeline, by start time */
export function latestPitch(timeline: TimelinePitcher[]) {
	let latest: TimelinePitch | undefined
	for (const { pitches } of timeline) {
		const last = pitches.at(-1)
		if (last && (!latest || last.startTime > latest.startTime)) latest = last
	}
	return latest
}

export type GameSnapshot = {
	/** The snapshot's own timecode, as the feed reports it */
	timecode: string
	feedLive: MLB.LiveGameFeed
	boxscore: MLB.Boxscore | null
	winProbability: MLB.PlayWinProbability[] | null
}

/**
 * The schedule entry as of a snapshot: its status, scores, and flags, so the scorebug
 * can't read ahead. Records and series standings move once a game ends, so they're
 * dropped when the real game is already over.
 */
export function gameAsOf(game: MLB.Game, snapshot: GameSnapshot): MLB.Game {
	const { gameData, liveData } = snapshot.feedLive
	const isOver = game.status.abstractGameState === 'Final'

	const team = (side: 'away' | 'home') => ({
		...game.teams[side],
		score: liveData?.linescore?.teams?.[side]?.runs ?? 0,
		leagueRecord: isOver ? undefined : game.teams[side].leagueRecord,
		isWinner: undefined,
	})

	return {
		...game,
		status: gameData?.status ?? game.status,
		teams: { away: team('away'), home: team('home') },
		...({ flags: gameData?.flags ?? {} } as object),
	} as MLB.Game
}
