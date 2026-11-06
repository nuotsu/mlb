/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import type { Hit, Vec3 } from './ascii-3d'
import {
	fieldDistance,
	flatDistance,
	flatMaterial,
	fold,
	GLOVE,
	GLOVE_BOX,
	gloveDistance,
	intersectGlove,
	LACE,
	LEATHER,
	LINING,
	POCKET,
	prepareGlove,
	SEAM,
	toObject,
	unfold,
	WEB_GAP,
} from './baseball-glove'

/** Deterministic PRNG so failures reproduce. */
function seeded(seed = 1) {
	return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

/** Walks out from inside the flat glove along `w` (`dir` +1 for the pocket side, −1 the back). */
function surface(u: number, v: number, dir = 1) {
	let w = 0
	while (flatDistance(u, v, w) < 0) w += 0.005 * dir
	return w
}

const inBox = (p: number[]) => p.every((v, i) => v >= GLOVE_BOX.min[i] && v <= GLOVE_BOX.max[i])

describe('shape', () => {
	test('folds and unfolds consistently', () => {
		for (const [u, v, w] of [
			[0, 0, 0],
			[3, 4, 0.2],
			[-2, -4.5, -0.3],
			[4.5, 2, 0.1],
			[1, 5.5, -0.2],
		]) {
			const p = unfold(...fold(u, v, w))
			expect(p.u).toBeCloseTo(u, 9)
			expect(p.v).toBeCloseTo(v, 9)
			expect(p.w).toBeCloseTo(w, 9)
		}
	})

	test('is cupped: its edges, fingertips and heel all rise in front of the pocket', () => {
		const pocket = fold(0.7, -1.5, surface(0.7, -1.5))[2]
		expect(fold(-2.7, -1.5, 0)[2] - pocket).toBeGreaterThan(1.2)
		expect(fold(5, 1.5, 0)[2] - pocket).toBeGreaterThan(0.7)
		expect(fold(0.7, 5.6, 0)[2] - pocket).toBeGreaterThan(1)
		expect(fold(0.3, -4.9, 0)[2] - pocket).toBeGreaterThan(0.5)
	})

	test('fits in the unit sphere and its bounding box', () => {
		const step = 0.025
		let farthest = 0
		for (let x = -1.2; x <= 1.2; x += step)
			for (let y = -1.2; y <= 1.2; y += step)
				for (let z = -1.2; z <= 1.2; z += step) {
					// Unfolding wraps around far from the glove; the tracer never looks there
					if (!inBox([x, y, z]) || gloveDistance(x, y, z) >= 0) continue
					farthest = Math.max(farthest, Math.hypot(x, y, z))
				}
		// Within a sample's reach of the sphere, but not past it
		expect(farthest).toBeLessThan(1 - step)
		expect(farthest).toBeGreaterThan(0.9)
		// Nothing of it pokes out of the box
		for (let u = -3; u <= 6; u += 0.25)
			for (let v = -6; v <= 7; v += 0.25)
				for (const dir of [1, -1]) {
					if (flatDistance(u, v, 0) >= 0) continue
					expect(inBox(toObject(fold(u, v, surface(u, v, dir))))).toBe(true)
				}
	})

	test('never claims more room than there is, so tracing can’t step through it', () => {
		const random = seeded(5)
		let checked = 0
		while (checked < 400) {
			const z = random() * 2 - 1,
				a = random() * 2 * Math.PI,
				r = Math.sqrt(1 - z * z)
			const d = [r * Math.cos(a), r * Math.sin(a), z]
			const o = GLOVE_BOX.min.map((lo, i) => lo + random() * (GLOVE_BOX.max[i] - lo))
			const at = (t: number) => o.map((v, i) => v + d[i] * t) as Vec3
			// Where a fine march first finds the glove
			let surfaceAt = Infinity
			for (let t = 0; inBox(at(t)); t += 0.002)
				if (gloveDistance(...at(t)) < 0) {
					surfaceAt = t
					break
				}
			if (surfaceAt === Infinity || surfaceAt === 0) continue
			checked++
			// No step along the way may claim more than is left
			for (let t = 0; t < surfaceAt; t += 0.01)
				expect(gloveDistance(...at(t))).toBeLessThanOrEqual(surfaceAt - t + 0.002)
		}
	})

	test('the sampled grid puts the surface where the exact distance does', () => {
		expect(prepareGlove()).toBe(true)
		const random = seeded(3)
		for (let n = 0; n < 20000; n++) {
			const p = GLOVE_BOX.min.map((lo, i) => lo + random() * (GLOVE_BOX.max[i] - lo)) as Vec3
			const exact = gloveDistance(...p)
			if (Math.abs(exact) < 0.015) continue
			expect(Math.sign(fieldDistance(...p))).toBe(Math.sign(exact))
		}
	})

	test('the sampled grid never claims more room than there is either', () => {
		prepareGlove()
		const random = seeded(9)
		let checked = 0
		while (checked < 400) {
			const z = random() * 2 - 1,
				a = random() * 2 * Math.PI,
				r = Math.sqrt(1 - z * z)
			const d = [r * Math.cos(a), r * Math.sin(a), z]
			const o = GLOVE_BOX.min.map((lo, i) => lo + random() * (GLOVE_BOX.max[i] - lo))
			const at = (t: number) => o.map((v, i) => v + d[i] * t) as Vec3
			let surfaceAt = Infinity
			for (let t = 0; inBox(at(t)); t += 0.002)
				if (gloveDistance(...at(t)) < 0) {
					surfaceAt = t
					break
				}
			if (surfaceAt === Infinity || surfaceAt === 0) continue
			checked++
			for (let t = 0; t < surfaceAt; t += 0.01)
				expect(fieldDistance(...at(t))).toBeLessThanOrEqual(surfaceAt - t + 0.004)
		}
	})

	test('can be prepared a slice at a time', () => {
		expect(GLOVE.prepare!(performance.now() + 1000)).toBe(true)
	})
})

describe('materials', () => {
	test('a darkened pocket on the palm, and plain leather behind it', () => {
		expect(flatMaterial(0.7, -1.5, surface(0.7, -1.5))).toBe(POCKET)
		expect(flatMaterial(0.3, -1, surface(0.3, -1, -1))).toBe(LEATHER)
	})

	test('welted seams between the stalls', () => {
		expect(flatMaterial(0, 3, surface(0, 3))).toBe(SEAM)
		expect(flatMaterial(0.66, 3, surface(0.66, 3))).toBe(LEATHER)
	})

	test('laces over the fingertips and bound around the heel', () => {
		let top = 5
		while (flatDistance(0.76, top, -0.1) < 0) top += 0.005
		expect(flatMaterial(0.76, top, -0.1)).toBe(LACE)
		const heel = [0, 0.25, 0.5].map((u) => {
			let v = -4.5
			while (flatDistance(u, v, -0.1) < 0) v -= 0.005
			return flatMaterial(u, v, -0.1)
		})
		expect(heel).toContain(LACE)
		expect(heel).toContain(LEATHER)
	})

	test('an I-web of laces with open gaps between them', () => {
		const rungs = [0.8, 1.1, 1.4, 1.7, 2].map((v) => flatMaterial(4.5, v, surface(4.5, v)))
		expect(rungs).toContain(LACE)
		expect(rungs).toContain(WEB_GAP)
	})

	test('lining inside the slot for the hand', () => {
		expect(flatMaterial(0.3, -3.45, surface(0.3, -3.45, -1))).toBe(LINING)
	})
})

describe('intersectGlove', () => {
	prepareGlove()
	const hit: Hit = { nx: 0, ny: 0, nz: 0, material: -1 }

	/** Casts from 2 radii out along `-direction` through `point`, returning the material hit. */
	function cast(point: Vec3, direction: Vec3) {
		const [x, y, z] = point
		const [dx, dy, dz] = direction
		return intersectGlove(x - 2 * dx, y - 2 * dy, z - 2 * dz, dx, dy, dz, hit) ? hit.material : null
	}

	test('looks into the pocket from the front', () => {
		expect(cast(toObject(fold(0.7, -1.5, 0)), [0, 0, -1])).toBe(POCKET)
		expect(hit.nz).toBeGreaterThan(0.8)
	})

	test('sees the slot for the hand from behind', () => {
		expect(cast(toObject(fold(0.3, -3.45, 0)), [0, 0, 1])).toBe(LINING)
	})

	test('misses around it', () => {
		expect(cast([0.95, 0.95, 0], [0, 0, -1])).toBeNull()
		expect(cast([0, 0, 0.99], [1, 0, 0])).toBeNull()
	})
})
