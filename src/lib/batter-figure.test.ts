/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import { ABS_ZONE, BATTER_OFFSET, batterPlacement, parseHeight } from './batter-figure'

describe('parseHeight', () => {
	test('feet and inches', () => {
		expect(parseHeight(`6' 2"`)).toBeCloseTo(6 + 2 / 12)
		expect(parseHeight(`5' 8"`)).toBeCloseTo(5 + 8 / 12)
		expect(parseHeight(`6'0"`)).toBe(6)
		expect(parseHeight(`7'`)).toBe(7)
	})

	test('unreadable', () => {
		expect(parseHeight(undefined)).toBeNull()
		expect(parseHeight('')).toBeNull()
		expect(parseHeight('tall')).toBeNull()
	})
})

describe('batterPlacement', () => {
	// José Ramírez (5' 8") and a 6' 7" batter, each from both sides, both seasons
	const cases = [5 + 8 / 12, 6 + 7 / 12].flatMap((height) =>
		(['L', 'R'] as const).flatMap((side) =>
			[2025, 2026].map((season) => ({ height, side, season })),
		),
	)

	test.each(cases)(
		'ABS zone sits on the body: $height ft, $side, $season',
		({ height, side, season }) => {
			const p = batterPlacement(height, side, season)
			const top = ABS_ZONE.top * height
			const bottom = ABS_ZONE.bottom * height
			// Bottom of the zone at the hollow of the knee
			expect(Math.abs(bottom - p.knee)).toBeLessThan(0.15)
			// Top of the zone just above the belt, well below the shoulders
			expect(top).toBeGreaterThan(p.belt)
			expect(top - p.belt).toBeLessThan(0.4)
		},
	)

	test.each(cases)('stands in the box: $height ft, $side, $season', ({ height, side, season }) => {
		const p = batterPlacement(height, side, season)
		// Soles on the ground, crouched below his full height
		expect(p.canvas.z - p.canvas.h).toBeLessThanOrEqual(0)
		expect(p.head).toBeCloseTo(0.82 * height)
		// Beside the plate on his side, not over it
		const plateEdge = 17 / 24
		if (side === 'R') expect(p.bounds.right).toBeLessThan(-plateEdge)
		else expect(p.bounds.left).toBeGreaterThan(plateEdge)
		expect(Math.abs((p.bounds.left + p.bounds.right) / 2)).toBeLessThan(BATTER_OFFSET + 0.5)
	})

	test('a taller batter is drawn taller on the same scale', () => {
		const short = batterPlacement(5.5, 'R', 2026)
		const tall = batterPlacement(6.6, 'R', 2026)
		expect(tall.canvas.h / short.canvas.h).toBeCloseTo(6.6 / 5.5)
	})

	test('unknown seasons use the latest renders', () => {
		expect(batterPlacement(6, 'L', 2031)).toEqual(batterPlacement(6, 'L', 2026))
		expect(batterPlacement(6, 'L')).toEqual(batterPlacement(6, 'L', 2026))
	})
})
