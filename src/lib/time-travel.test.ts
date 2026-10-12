/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import {
	adjacentPitch,
	DELAY_TTL_MS,
	delaySince,
	delayStorageKey,
	latestPitch,
	parseDelay,
	pitchStartTimes,
	pitchTimeline,
	readStoredDelay,
	restoreDelayScript,
	toTimecode,
	writeStoredDelay,
} from './time-travel'

describe('toTimecode', () => {
	test('formats UTC and floors to the second', () => {
		expect(toTimecode(Date.parse('2026-10-09T00:08:51.917Z'))).toBe('20261009_000851')
		expect(toTimecode(Date.parse('2026-01-02T23:59:59.999Z'))).toBe('20260102_235959')
	})
})

describe('parseDelay', () => {
	test('reads whole seconds into ms', () => {
		expect(parseDelay('95')).toBe(95_000)
		expect(parseDelay('95.9')).toBe(95_000)
	})

	test('treats anything else as live', () => {
		for (const value of [null, undefined, '', '0', '-5', 'abc']) {
			expect(parseDelay(value)).toBeNull()
		}
	})
})

describe('delaySince', () => {
	test('rounds down so the target never lands before the pitch', () => {
		const start = '2026-10-09T00:08:51.917Z'
		const now = Date.parse(start) + 61_500
		const delay = delaySince(start, now)

		expect(delay).toBe(61_000)
		expect(now - delay).toBeGreaterThanOrEqual(Date.parse(start))
		expect(toTimecode(now - delay)).toBe('20261009_000852')
	})

	test('never goes negative', () => {
		expect(delaySince('2026-10-09T00:08:51.917Z', Date.parse('2026-10-09T00:08:50Z'))).toBe(0)
	})
})

function pitch(startTime: string): MLB.PlayEvent {
	return { isPitch: true, startTime, details: { code: 'B' } as MLB.PitchDetails }
}

function change(id: number, startTime: string): MLB.PlayEvent {
	return {
		isPitch: false,
		startTime,
		player: { id } as MLB.Person,
		details: { eventType: 'pitching_substitution' } as MLB.PitchDetails,
	}
}

function play(
	isTopInning: boolean,
	pitcher: { id: number; fullName: string },
	playEvents: MLB.PlayEvent[],
) {
	return {
		about: { isTopInning },
		matchup: { pitcher },
		playEvents,
	} as unknown as MLB.Play
}

const smith = { id: 1, fullName: 'Hagen Smith' }
const fedde = { id: 2, fullName: 'Erick Fedde' }
const bibee = { id: 3, fullName: 'Tanner Bibee' }

const players = {
	ID1: { fullName: 'Hagen Smith', lastName: 'Smith' },
	ID2: { fullName: 'Erick Fedde', lastName: 'Fedde' },
	ID3: { fullName: 'Tanner Bibee', lastName: 'Bibee' },
}

describe('pitchTimeline', () => {
	test('groups pitches by pitcher in the order they appeared, counting each', () => {
		const timeline = pitchTimeline(
			[
				play(true, smith, [pitch('2026-10-09T00:01:00Z'), pitch('2026-10-09T00:01:20Z')]),
				play(false, bibee, [pitch('2026-10-09T00:05:00Z')]),
				play(true, smith, [pitch('2026-10-09T00:09:00Z')]),
			],
			players,
		)

		expect(timeline.map((p) => [p.lastName, p.pitches.map((x) => x.number)])).toEqual([
			['Smith', [1, 2, 3]],
			['Bibee', [1]],
		])
	})

	test('credits pitches before a mid-at-bat change to the pitcher being replaced', () => {
		const timeline = pitchTimeline(
			[
				play(true, smith, [pitch('2026-10-09T00:01:00Z')]),
				// Fedde finishes the plate appearance, so he's the matchup pitcher
				play(true, fedde, [
					pitch('2026-10-09T00:02:00Z'),
					change(2, '2026-10-09T00:02:30Z'),
					pitch('2026-10-09T00:04:00Z'),
				]),
			],
			players,
		)

		expect(timeline.map((p) => [p.fullName, p.pitches.map((x) => x.startTime)])).toEqual([
			['Hagen Smith', ['2026-10-09T00:01:00Z', '2026-10-09T00:02:00Z']],
			['Erick Fedde', ['2026-10-09T00:04:00Z']],
		])
	})

	test('skips events without a start time and non-pitches', () => {
		const timeline = pitchTimeline([
			play(true, smith, [{ isPitch: false, startTime: '2026-10-09T00:00:30Z' }, { isPitch: true }]),
		])

		expect(timeline).toEqual([])
	})

	test('finds the latest pitch across pitchers', () => {
		const timeline = pitchTimeline(
			[
				play(true, smith, [pitch('2026-10-09T00:01:00Z')]),
				play(false, bibee, [pitch('2026-10-09T00:05:00Z')]),
			],
			players,
		)

		expect(latestPitch(timeline)).toEqual({ startTime: '2026-10-09T00:05:00Z', number: 1 })
		expect(latestPitch([])).toBeUndefined()
	})
})

describe('stepping by pitch', () => {
	const times = pitchStartTimes([
		play(true, smith, [
			pitch('2026-10-09T00:01:20Z'),
			{ isPitch: false, startTime: '2026-10-09T00:01:30Z' },
			pitch('2026-10-09T00:01:00Z'),
		]),
		play(false, bibee, [pitch('2026-10-09T00:05:00Z'), { isPitch: true }]),
	])

	test('lists pitches only, oldest first', () => {
		expect(times).toEqual(['2026-10-09T00:01:00Z', '2026-10-09T00:01:20Z', '2026-10-09T00:05:00Z'])
	})

	test('steps one pitch either way', () => {
		expect(adjacentPitch(times, '2026-10-09T00:01:20Z', -1)).toBe('2026-10-09T00:01:00Z')
		expect(adjacentPitch(times, '2026-10-09T00:01:20Z', 1)).toBe('2026-10-09T00:05:00Z')
	})

	test('runs out at either end', () => {
		expect(adjacentPitch(times, '2026-10-09T00:01:00Z', -1)).toBeUndefined()
		expect(adjacentPitch(times, '2026-10-09T00:05:00Z', 1)).toBeUndefined()
	})

	test('before the first pitch, forward lands on it and back goes nowhere', () => {
		expect(adjacentPitch(times, undefined, 1)).toBe('2026-10-09T00:01:00Z')
		expect(adjacentPitch(times, undefined, -1)).toBeUndefined()
	})
})

function memoryStorage(initial: Record<string, string> = {}) {
	const items = new Map(Object.entries(initial))
	return {
		items,
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value),
		removeItem: (key: string) => void items.delete(key),
	}
}

describe('saved delay', () => {
	const now = Date.parse('2026-10-09T02:00:00Z')

	test('saves per game and reads back', () => {
		const storage = memoryStorage()
		writeStoredDelay(storage, 849832, 95_400, now)

		expect(readStoredDelay(storage, 849832, now + 60_000)).toBe(95_000)
		expect(readStoredDelay(storage, 849809, now)).toBeNull()
	})

	test('going live forgets it', () => {
		const storage = memoryStorage()
		writeStoredDelay(storage, 849832, 95_000, now)
		writeStoredDelay(storage, 849832, null, now)

		expect(storage.items.size).toBe(0)
	})

	test('expires and clears itself', () => {
		const storage = memoryStorage()
		writeStoredDelay(storage, 849832, 95_000, now)

		expect(readStoredDelay(storage, 849832, now + DELAY_TTL_MS)).toBeNull()
		expect(storage.items.size).toBe(0)
	})

	test('shrugs off junk and blocked storage', () => {
		expect(readStoredDelay(memoryStorage({ [delayStorageKey(1)]: '{' }), 1, now)).toBeNull()

		const blocked = {
			getItem: () => {
				throw new Error('denied')
			},
			setItem: () => {
				throw new Error('denied')
			},
			removeItem: () => {},
		}
		expect(readStoredDelay(blocked, 1, now)).toBeNull()
		expect(() => writeStoredDelay(blocked, 1, 5_000, now)).not.toThrow()
	})
})

describe('restoreDelayScript', () => {
	/** Run the inline script against a fake page; returns where it sent the browser, if anywhere */
	function run(href: string, saved?: object, at = Date.now()) {
		const storage = memoryStorage(saved ? { [delayStorageKey(849832)]: JSON.stringify(saved) } : {})
		let replaced: string | undefined
		const location = { href, replace: (url: string) => (replaced = url) }
		const date = { now: () => at }
		new Function('localStorage', 'location', 'Date', restoreDelayScript(849832))(
			storage,
			location,
			date,
		)
		return { replaced, storage }
	}

	const at = Date.parse('2026-10-09T02:00:00Z')

	test('adds the saved delay and reloads', () => {
		const { replaced } = run(
			'https://x.test/game/849832?view=scorecard',
			{ delay: 95, savedAt: at },
			at,
		)
		expect(replaced).toBe('https://x.test/game/849832?view=scorecard&delay=95')
	})

	test('leaves an explicit delay, or no saved one, alone', () => {
		expect(
			run('https://x.test/game/849832?delay=30', { delay: 95, savedAt: at }, at).replaced,
		).toBeUndefined()
		expect(run('https://x.test/game/849832').replaced).toBeUndefined()
	})

	test('drops an expired one without reloading', () => {
		const { replaced, storage } = run(
			'https://x.test/game/849832',
			{ delay: 95, savedAt: at - DELAY_TTL_MS },
			at,
		)
		expect(replaced).toBeUndefined()
		expect(storage.items.size).toBe(0)
	})
})
