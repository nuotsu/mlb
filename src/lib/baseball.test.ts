/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import {
	advance,
	decaySpin,
	dot,
	GROOVE,
	IDLE_SPIN,
	LEATHER,
	length,
	MAX_SPIN,
	nearestSeam,
	quatFromRotation,
	randomOrientation,
	REGULATION_STITCHES,
	releaseSpin,
	rotationBetween,
	rotationMatrix,
	SEAM_LENGTH,
	seamPoint,
	seamStyle,
	sphereAt,
	surfaceAt,
	THREAD,
	type Mat3,
	type Vec3,
} from './baseball'

const apply = (m: Mat3, v: Vec3): Vec3 => [
	m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
	m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
	m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
]

/** Deterministic PRNG so failures reproduce. */
function seeded(seed = 1) {
	return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

function randomUnit(random: () => number): Vec3 {
	const z = random() * 2 - 1
	const a = random() * 2 * Math.PI
	const r = Math.sqrt(1 - z * z)
	return [r * Math.cos(a), r * Math.sin(a), z]
}

describe('seam', () => {
	test('stays on the surface of the ball', () => {
		for (let t = 0; t < 2 * Math.PI; t += 0.1) expect(length(seamPoint(t))).toBeCloseTo(1, 12)
	})

	test('splits the ball into two congruent covers', () => {
		// A half-turn about z maps the seam onto itself
		for (let t = 0; t < 2 * Math.PI; t += 0.1) {
			const [x, y, z] = seamPoint(t)
			const turned = seamPoint(t + Math.PI)
			;[-x, -y, z].forEach((v, i) => expect(turned[i]).toBeCloseTo(v, 12))
		}
	})

	test('finds the nearest seam point like a brute-force search', () => {
		const random = seeded(7)
		const fine = Array.from({ length: 20000 }, (_, i) => seamPoint((i / 20000) * 2 * Math.PI))
		for (let n = 0; n < 200; n++) {
			const p = randomUnit(random)
			const brute = Math.min(...fine.map((s) => Math.hypot(p[0] - s[0], p[1] - s[1], p[2] - s[2])))
			const hit = nearestSeam(...p, 2)
			expect(hit).not.toBeNull()
			expect(hit!.distance).toBeCloseTo(brute, 3)
		}
	})

	test('measures arc length along the seam', () => {
		const quarter = nearestSeam(...seamPoint(Math.PI / 2), 0.1)!
		expect(quarter.distance).toBeCloseTo(0, 6)
		// The curve's symmetry puts a quarter of its length in each quarter-turn of t
		expect(quarter.arc).toBeCloseTo(SEAM_LENGTH / 4, 2)
	})

	test('rejects points far from the seam', () => {
		// The middle of a cover
		expect(nearestSeam(0, 0, 1, 0.2)).toBeNull()
	})
})

describe('seamStyle', () => {
	test('uses regulation stitching when the grid is fine enough', () => {
		expect(SEAM_LENGTH / seamStyle(0.001).spacing).toBeCloseTo(REGULATION_STITCHES, 6)
	})

	test('coarsens stitches to stay legible on a coarse grid', () => {
		const style = seamStyle(0.06)
		expect(style.spacing).toBeGreaterThanOrEqual(2 * 0.06)
		// A whole number of stitches around the loop, so none is cut short where it closes
		const count = SEAM_LENGTH / style.spacing
		expect(count).toBeCloseTo(Math.round(count), 9)
	})
})

describe('surfaceAt', () => {
	const style = seamStyle(0.02)

	test('is leather in the middle of a cover', () => {
		expect(surfaceAt(0, 0, 1, style)).toBe(LEATHER)
	})

	test('has a groove along the seam line', () => {
		expect(surfaceAt(...seamPoint(0.3), style)).toBe(GROOVE)
	})

	test('stitches cover a share of the band beside the seam', () => {
		const random = seeded(3)
		let thread = 0,
			band = 0
		while (band < 2000) {
			const p = randomUnit(random)
			const hit = nearestSeam(...p, 1)!
			if (hit.distance < style.groove + 0.01 || hit.distance > style.reach - 0.01) continue
			band++
			if (surfaceAt(...p, style) === THREAD) thread++
		}
		expect(thread / band).toBeCloseTo(style.thread / style.spacing, 1)
	})
})

describe('spin', () => {
	test('drag slows a fast spin toward the idle rate', () => {
		const after = [0.25, 1, 4].map((t) => decaySpin(40, t))
		expect(after[0]).toBeLessThan(40)
		expect(after[1]).toBeLessThan(after[0])
		expect(after[2]).toBeLessThan(after[1])
		expect(after[2]).toBeGreaterThan(IDLE_SPIN)
		expect(decaySpin(40, 60)).toBeCloseTo(IDLE_SPIN, 6)
	})

	test('a slower ball just coasts', () => {
		expect(decaySpin(IDLE_SPIN / 2, 1)).toBe(IDLE_SPIN / 2)
	})

	test("doesn't depend on the frame rate", () => {
		let speed = 30
		for (let i = 0; i < 120; i++) speed = decaySpin(speed, 1 / 120)
		expect(speed).toBeCloseTo(decaySpin(30, 1), 9)
	})

	test('keeps the spin axis fixed in space', () => {
		const start = randomOrientation(seeded(5))
		let state = { orientation: start, spin: [0, 3, 4] as Vec3 }
		for (let i = 0; i < 60; i++) state = advance(state.orientation, state.spin, 1 / 60)
		const axis: Vec3 = [0, 0.6, 0.8]
		state.spin.forEach((v, i) => expect(v / length(state.spin)).toBeCloseTo(axis[i], 12))
		// The leather on the axis hasn't moved
		const leather = apply(transpose(rotationMatrix(start)), axis)
		apply(rotationMatrix(state.orientation), leather).forEach((v, i) =>
			expect(v).toBeCloseTo(axis[i], 9),
		)
	})

	test('turns by the integrated angle', () => {
		// Below the idle rate there's no drag, so it turns exactly ω·t
		const { orientation } = advance([1, 0, 0, 0], [0, 0, IDLE_SPIN], 1)
		const [x, y] = apply(rotationMatrix(orientation), [1, 0, 0])
		expect(Math.atan2(y, x)).toBeCloseTo(IDLE_SPIN, 9)
	})
})

function transpose(m: Mat3): Mat3 {
	return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]
}

describe('dragging', () => {
	test('the point under the pointer stays under it', () => {
		const from = sphereAt(0.2, -0.1)
		const to = sphereAt(-0.3, 0.4)
		const moved = apply(rotationMatrix(quatFromRotation(rotationBetween(from, to))), from)
		moved.forEach((v, i) => expect(v).toBeCloseTo(to[i], 12))
	})

	test('rolls smoothly past the edge of the ball', () => {
		const inside = sphereAt(0.7071, 0)
		const outside = sphereAt(0.7072, 0)
		expect(dot(inside, outside)).toBeCloseTo(1, 3)
		expect(length(sphereAt(3, 4))).toBeCloseTo(1, 12)
	})

	test('a fling keeps the drag’s angular velocity', () => {
		// 0.05 rad about y every 10ms → 5 rad/s
		const samples = Array.from({ length: 20 }, (_, i) => ({
			time: i * 10,
			rotation: [0, 0.05, 0] as Vec3,
		}))
		const spin = releaseSpin(samples, 190)
		expect(spin[0]).toBeCloseTo(0, 9)
		expect(spin[1]).toBeCloseTo(5, 6)
	})

	test('holding still before letting go leaves it still', () => {
		expect(releaseSpin([{ time: 0, rotation: [0, 1, 0] }], 500)).toEqual([0, 0, 0])
	})

	test('caps the spin a fling can impart', () => {
		expect(length(releaseSpin([{ time: 0, rotation: [0, 10, 0] }], 1))).toBeCloseTo(MAX_SPIN, 9)
	})
})
