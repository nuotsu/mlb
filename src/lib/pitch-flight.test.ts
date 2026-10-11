/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import {
	BALL_RADIUS,
	pitchFlight,
	pitchLocation,
	PLATE_FRONT_Y,
	project,
	zonePlaneY,
} from './pitch-flight'

/** Burke's two called-strike cutters to José Ramírez, gamePk 849831, at-bat 23 (Statcast zone 2). */
const CALLED_STRIKES: MLB.PitchData[] = [
	{
		strikeZoneTop: 3.035,
		strikeZoneBottom: 1.532,
		strikeZoneDepth: 8.5,
		extension: 6.6,
		coordinates: {
			pX: -0.2353751161364803,
			pZ: 3.1736032748955125,
			x0: -2.259692745309839,
			y0: 50.00314498819723,
			z0: 5.900566383813622,
			vX0: 4.197256323752846,
			vY0: -129.46357567370694,
			vZ0: -2.5102381370104636,
			aX: 5.084335819497259,
			aY: 25.22275909433792,
			aZ: -22.96850848420839,
		},
	},
	{
		strikeZoneTop: 3.035,
		strikeZoneBottom: 1.532,
		strikeZoneDepth: 8.5,
		extension: 6.6,
		coordinates: {
			pX: -0.08156463951252464,
			pZ: 3.2227296010114395,
			x0: -2.225619274105044,
			y0: 50.00492075613278,
			z0: 5.88066197915639,
			vX0: 4.454458415387558,
			vY0: -129.81922193128622,
			vZ0: -2.0878732197899934,
			aX: 5.439581818272261,
			aY: 25.2012593281962,
			aZ: -24.404826405092358,
		},
	},
]

describe('zonePlaneY', () => {
	test('ABS judges the middle of the plate', () => {
		expect(zonePlaneY({ strikeZoneDepth: 8.5 })).toBeCloseTo(17 / 24)
	})

	test('2025 judged the front, where pX / pZ are', () => {
		expect(zonePlaneY({ strikeZoneDepth: 17 })).toBeCloseTo(PLATE_FRONT_Y)
	})

	test('unreported is the middle', () => {
		expect(zonePlaneY({})).toBeCloseTo(17 / 24)
		expect(zonePlaneY(undefined)).toBeCloseTo(17 / 24)
	})
})

describe('pitchLocation', () => {
	test.each(CALLED_STRIKES)('a called strike above pZ touches the zone at mid-plate', (pitch) => {
		const top = pitch.strikeZoneTop!
		// Over the top at the front of the plate, even with the ball's size
		expect(pitch.coordinates!.pZ! - BALL_RADIUS).toBeGreaterThan(top)
		const at = pitchLocation(pitch)!
		expect(at.z).toBeLessThan(pitch.coordinates!.pZ!)
		expect(at.z - BALL_RADIUS).toBeLessThanOrEqual(top)
		expect(Math.abs(at.x)).toBeLessThan(17 / 24)
	})

	test('the flight ends on it and still runs through pX / pZ', () => {
		const pitch = CALLED_STRIKES[0]
		const flight = pitchFlight(pitch)!
		const end = flight.at(-1)!
		expect(end.y).toBeCloseTo(17 / 24)
		expect(pitchLocation(pitch, flight)).toEqual({ x: end.x, z: end.z })

		const front = flight.findLast((p) => p.y >= PLATE_FRONT_Y)!
		const next = flight[flight.indexOf(front) + 1]
		const f = (front.y - PLATE_FRONT_Y) / (front.y - next.y)
		expect(front.z + (next.z - front.z) * f).toBeCloseTo(pitch.coordinates!.pZ!, 2)
	})

	test('falls back to pX / pZ without a fit', () => {
		expect(pitchLocation({ coordinates: { pX: 0.3, pZ: 2.1 } })).toEqual({ x: 0.3, z: 2.1 })
		expect(pitchLocation({})).toBeNull()
	})
})

describe('project', () => {
	test('the camera plane keeps its true size', () => {
		const camera = { distance: 15, height: 3.5, plane: 17 / 24 }
		const p = project(camera, 0.5, 17 / 24, 2.5)
		expect(p.x).toBeCloseTo(0.5)
		expect(p.z).toBeCloseTo(2.5)
		expect(p.scale).toBeCloseTo(1)
	})
})
