/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import { advance, apply, rotationMatrix, type Hit, type Vec3 } from './ascii-3d'
import {
	HOME_PLATE,
	intersectPlate,
	PLATE_CORNERS,
	PLATE_FACES,
	PLATE_HALF_THICKNESS,
	RUBBER,
	TOP,
} from './home-plate'

const hit: Hit = { nx: 0, ny: 0, nz: 0, material: -1 }
const edge = (i: number) => {
	const [a, b] = [PLATE_CORNERS[i], PLATE_CORNERS[(i + 1) % PLATE_CORNERS.length]]
	return Math.hypot(b[0] - a[0], b[1] - a[1])
}

describe('outline', () => {
	test('is regulation: 17" across, 8.5" sides, 12" to the point', () => {
		const side = edge(0)
		expect(edge(3)).toBeCloseTo(side, 12)
		expect(edge(4) / side).toBeCloseTo(17 / 8.5, 12)
		expect(edge(1) / side).toBeCloseTo(12 / 8.5, 12)
		expect(edge(2) / side).toBeCloseTo(12 / 8.5, 12)
	})

	test('just fits in the unit sphere', () => {
		const reach = Math.max(...PLATE_CORNERS.map(([x, y]) => Math.hypot(x, y, PLATE_HALF_THICKNESS)))
		expect(reach).toBeLessThan(1)
		expect(reach).toBeGreaterThan(0.98)
	})

	test('is a convex slab: the bottom corners and the center sit inside every face', () => {
		const side = (f: (typeof PLATE_FACES)[number], p: Vec3) =>
			f.nx * p[0] + f.ny * p[1] + f.nz * p[2] - f.d
		for (const f of PLATE_FACES) {
			expect(side(f, [0, 0, 0])).toBeLessThan(-0.01)
			for (const [x, y] of PLATE_CORNERS)
				expect(side(f, [x, y, -PLATE_HALF_THICKNESS])).toBeLessThanOrEqual(1e-9)
		}
	})
})

describe('intersectPlate', () => {
	test('meets the white top from above', () => {
		expect(intersectPlate(0, 0, 2, 0, 0, -1, hit)).toBe(true)
		expect(hit.material).toBe(TOP)
		expect([hit.nx, hit.ny, hit.nz]).toEqual([0, 0, 1])
	})

	test('has a dark bevel around the top', () => {
		// Just inside the front edge
		const [, y] = PLATE_CORNERS[0]
		expect(intersectPlate(0, y - 0.02, 2, 0, 0, -1, hit)).toBe(true)
		expect(hit.material).toBe(RUBBER)
		expect(hit.ny).toBeGreaterThan(0.3)
		expect(hit.nz).toBeGreaterThan(0.3)
	})

	test('is dark underneath and misses beside it', () => {
		expect(intersectPlate(0, 0, -2, 0, 0, 1, hit)).toBe(true)
		expect(hit.material).toBe(RUBBER)
		expect(hit.nz).toBe(-1)
		expect(intersectPlate(0.99, 0.5, 2, 0, 0, -1, hit)).toBe(false)
		// Edge on
		expect(intersectPlate(2, 0, PLATE_HALF_THICKNESS * 2, -1, 0, 0, hit)).toBe(false)
		expect(intersectPlate(2, 0, 0, -1, 0, 0, hit)).toBe(true)
	})
})

describe('HOME_PLATE', () => {
	test('turns flat like a turntable, its top always facing the viewer', () => {
		let state = HOME_PLATE.start(() => 0.2)
		const facing = (): Vec3 => apply(rotationMatrix(state.orientation), [0, 0, 1])
		const first = facing()
		expect(first[2]).toBeGreaterThan(0.7)
		for (let t = 0; t < 13; t += 0.5) {
			state = advance(state.orientation, state.spin, 0.5)
			facing().forEach((v, i) => expect(v).toBeCloseTo(first[i], 9))
		}
	})
})
