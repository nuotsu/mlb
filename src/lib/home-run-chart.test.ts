/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import {
	angleOf,
	directionFromAngle,
	directionFromDescription,
	distanceOf,
	fenceDistanceAt,
	fenceDistances,
	flightPath,
	GENERIC_FIELD,
	hitChartToFeet,
	landingSpot,
	separate,
	teamChartColors,
} from './home-run-chart'

// Rate Field, from gamePk 849832
const RATE_FIELD = fenceDistances({
	leftLine: 330,
	leftCenter: 377,
	center: 400,
	rightCenter: 372,
	rightLine: 335,
})

describe('fenceDistances', () => {
	test('falls back to a generic park, field by field', () => {
		expect(fenceDistances()).toEqual(Object.values(GENERIC_FIELD))
		expect(fenceDistances({ center: 420 })).toEqual([330, 375, 420, 375, 330])
	})
})

describe('fenceDistanceAt', () => {
	test('passes through each published distance', () => {
		expect(fenceDistanceAt(RATE_FIELD, -45)).toBeCloseTo(330)
		expect(fenceDistanceAt(RATE_FIELD, -22.5)).toBeCloseTo(377)
		expect(fenceDistanceAt(RATE_FIELD, 0)).toBeCloseTo(400)
		expect(fenceDistanceAt(RATE_FIELD, 22.5)).toBeCloseTo(372)
		expect(fenceDistanceAt(RATE_FIELD, 45)).toBeCloseTo(335)
	})

	test('stays between neighbors and clamps past the poles', () => {
		const lcf = fenceDistanceAt(RATE_FIELD, -11)
		expect(lcf).toBeGreaterThan(377)
		expect(lcf).toBeLessThan(400)
		expect(fenceDistanceAt(RATE_FIELD, 60)).toBeCloseTo(335)
	})
})

describe('hit chart coordinates', () => {
	test('home plate is the origin', () => {
		const p = hitChartToFeet(125.42, 198.27)
		expect(p.x).toBeCloseTo(0)
		expect(p.y).toBeCloseTo(0)
	})

	// The three home runs in 849832, with their reported totalDistance.
	test.each([
		[220.31, 93.23, 376, 'RF'],
		[194.92, 62.3, 378, 'RCF'],
		[22.94, 80.65, 386, 'LF'],
	] as const)('(%p, %p) lands near %p ft to %p', (coordX, coordY, totalDistance, direction) => {
		const p = hitChartToFeet(coordX, coordY)
		expect(Math.abs(distanceOf(p) - totalDistance) / totalDistance).toBeLessThan(0.07)
		expect(directionFromAngle(angleOf(p))).toBe(direction)
	})
})

describe('directionFromDescription', () => {
	test('reads hyphenated and spaced fields', () => {
		expect(directionFromDescription('homers (4) on a fly ball to left-center field.')).toBe('LCF')
		expect(directionFromDescription('homers (1) on a fly ball to right center field.')).toBe('RCF')
		expect(directionFromDescription('homers (1) on a line drive to right field.')).toBe('RF')
		expect(directionFromDescription('homers (12) on a fly ball to center field.')).toBe('CF')
		expect(directionFromDescription('homers (12).')).toBeUndefined()
	})
})

describe('landingSpot', () => {
	test('pushes a home run whose coordinates fall short over the fence', () => {
		// Patrick Bailey, 849832: coordinates read ~354 ft, the fence there is ~340 ft
		const spot = landingSpot({
			hitData: { totalDistance: 376, coordinates: { coordX: 220.31, coordY: 93.23 } },
			description: 'Patrick Bailey homers (1) on a line drive to right field.',
			distances: RATE_FIELD,
		})
		expect(distanceOf(spot)).toBeGreaterThan(fenceDistanceAt(RATE_FIELD, angleOf(spot)))
	})

	test('keeps an inside-the-park home run inside the fence', () => {
		const spot = landingSpot({
			hitData: { totalDistance: 430, coordinates: { coordX: 125.42, coordY: 30 } },
			description:
				'James Wood hits an inside-the-park grand slam (13) on a fly ball to center field.',
			distances: RATE_FIELD,
		})
		expect(distanceOf(spot)).toBeLessThan(400)
	})

	test('uses totalDistance and the described field without coordinates', () => {
		const spot = landingSpot({
			hitData: { totalDistance: 410 },
			description: 'homers (8) on a fly ball to left field.',
			distances: RATE_FIELD,
		})
		expect(distanceOf(spot)).toBeCloseTo(410)
		expect(directionFromAngle(angleOf(spot))).toBe('LF')
	})

	test('still lands past the fence with no hit data at all', () => {
		const spot = landingSpot({ description: 'homers (2).', distances: RATE_FIELD })
		expect(angleOf(spot)).toBeCloseTo(0)
		expect(distanceOf(spot)).toBeGreaterThan(400)
	})
})

describe('separate', () => {
	test('spreads overlapping points to the minimum gap', () => {
		const out = separate(
			[
				{ x: 100, y: 300 },
				{ x: 100, y: 300 },
				{ x: 104, y: 301 },
			],
			16,
		)
		for (let i = 0; i < out.length; i++) {
			for (let j = i + 1; j < out.length; j++) {
				expect(Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y)).toBeGreaterThan(15.5)
			}
		}
	})

	test('leaves points that are already apart alone', () => {
		const points = [
			{ x: -200, y: 300 },
			{ x: 200, y: 300 },
		]
		expect(separate(points, 16)).toEqual(points)
	})
})

describe('flightPath', () => {
	test('bulges more for higher launch angles, toward the outfield', () => {
		const end = { x: 250, y: 250 }
		const low = flightPath(end, 15).control
		const high = flightPath(end, 40).control
		expect(distanceOf({ x: high.x - 125, y: high.y - 125 })).toBeGreaterThan(
			distanceOf({ x: low.x - 125, y: low.y - 125 }),
		)
		expect(high.y).toBeGreaterThan(125)
		expect(flightPath({ x: -250, y: 250 }, 30).control.y).toBeGreaterThan(125)
	})
})

describe('teamChartColors', () => {
	test('switches the home side when both clubs share a color', () => {
		const { away, home } = teamChartColors('#0c2340', '#0c2340', '#72f088')
		expect(home.dark).not.toBe(away.dark)
	})

	test('keeps distinct club colors', () => {
		const { home } = teamChartColors('#0c2340', '#c41e3a', '#72f088')
		expect(home.light).toBe(teamChartColors('#c41e3a', '#0c2340', '#72f088').away.light)
	})
})
