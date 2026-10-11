/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import { delaySince, latestPitch, parseDelay, pitchTimeline, toTimecode } from './time-travel'

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
