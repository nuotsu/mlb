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
