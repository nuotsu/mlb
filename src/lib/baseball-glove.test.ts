/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import type { Hit, Vec3 } from './ascii-3d'
import {
	fieldDistance,
	GLOVE,
	GLOVE_BOX,
	gloveDistance,
	intersectGlove,
	LACE,
	LEATHER,
	LINING,
	POCKET,
	prepareGlove,
} from './baseball-glove'

/** Design units (how the parts are laid out) → object radii. */
const CENTER: Vec3 = [0.028, 0.034, 0.179]
const SIZE = 0.92
const at = (x: number, y: number, z = 0): Vec3 => [
	(x - CENTER[0]) / SIZE,
	(y - CENTER[1]) / SIZE,
	(z - CENTER[2]) / SIZE,
]

const hit: Hit = { nx: 0, ny: 0, nz: 0, material: -1 }

/** Casts from 2 radii out along `-direction` through `point`, returning the material hit. */
function cast(point: Vec3, direction: Vec3) {
	const [x, y, z] = point
	const [dx, dy, dz] = direction
	return intersectGlove(x - 2 * dx, y - 2 * dy, z - 2 * dz, dx, dy, dz, hit) ? hit.material : null
}

describe('shape', () => {
	test('fits in the unit sphere and its bounding box', () => {
		const step = 0.025
		let farthest = 0
		for (let x = -1.2; x <= 1.2; x += step)
			for (let y = -1.2; y <= 1.2; y += step)
				for (let z = -1.2; z <= 1.2; z += step) {
					if (gloveDistance(x, y, z) >= 0) continue
					farthest = Math.max(farthest, Math.hypot(x, y, z))
					;[x, y, z].forEach((v, i) => {
						expect(v).toBeGreaterThan(GLOVE_BOX.min[i])
						expect(v).toBeLessThan(GLOVE_BOX.max[i])
					})
				}
		// Within a sample's reach of the sphere, but not past it
		expect(farthest).toBeLessThan(1 - step)
		expect(farthest).toBeGreaterThan(0.9)
	})

	test('the sampled grid matches the exact distance near the surface', () => {
		expect(prepareGlove()).toBe(true)
		let seed = 3
		const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
		let checked = 0
		while (checked < 3000) {
			const p = GLOVE_BOX.min.map((lo, i) => lo + random() * (GLOVE_BOX.max[i] - lo)) as Vec3
			const exact = gloveDistance(...p)
			if (exact < 0 || exact > 0.05) continue
			checked++
			expect(Math.abs(fieldDistance(...p) - exact)).toBeLessThan(0.012)
		}
	})

	test('can be prepared a slice at a time', () => {
		expect(GLOVE.prepare!(performance.now() + 1000)).toBe(true)
	})
})

describe('intersectGlove', () => {
	test('shows the pocket from the front, facing the viewer', () => {
		expect(cast(at(0, -0.18), [0, 0, -1])).toBe(POCKET)
		expect(hit.nz).toBeGreaterThan(0.9)
	})

	test('shows the back of the hand and the opening for it from behind', () => {
		expect(cast(at(-0.02, -0.1), [0, 0, 1])).toBe(LEATHER)
		expect(hit.nz).toBeLessThan(-0.9)
		expect(cast(at(-0.02, -0.52), [0, 0, 1])).toBe(LINING)
	})

	test('laces over the fingertips', () => {
		// The middle finger, curled toward the pocket, seen from above
		const z = 0.04 + 0.55 * 0.65 ** 2
		expect(cast(at(0.08, 0.9, z), [0, -1, 0])).toBe(LACE)
		expect(hit.ny).toBeGreaterThan(0.8)
		expect(cast(at(0.05, 0.9, z), [0, -1, 0])).toBe(LEATHER)
		expect(cast(at(0.11, 0.9, z), [0, -1, 0])).toBe(LEATHER)
	})

	test('laces the web like a ladder and binds the heel', () => {
		const rungs = [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15].map((dy) =>
			cast(at(0.51, 0.34 + dy), [0, 0, -1]),
		)
		expect(rungs).toContain(LACE)
		expect(rungs).toContain(LEATHER)
		expect(cast(at(0, -0.8), [0, 1, 0])).toBe(LACE)
	})

	test('misses around it', () => {
		expect(cast([0.95, 0.95, 0], [0, 0, -1])).toBeNull()
		expect(cast([0, 0, 0.99], [1, 0, 0])).toBeNull()
	})
})
