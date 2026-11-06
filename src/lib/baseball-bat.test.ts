/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import { advance, apply, rotationMatrix, type Hit, type Vec3 } from './ascii-3d'
import { BAT, BAT_RADIUS, batRadius, intersectBat, LOGO, TAPE, WOOD } from './baseball-bat'

const hit: Hit = { nx: 0, ny: 0, nz: 0, material: -1 }

/** Casts a ray at the bat from +x (or `from`) toward its axis at height `z`. */
function side(z: number, from: Vec3 = [1, 0, 0]) {
	const ok = intersectBat(2 * from[0], 2 * from[1], z, -from[0], -from[1], 0, hit)
	return ok ? { ...hit } : null
}

describe('profile', () => {
	test('fits in the unit sphere', () => {
		let widest = 0
		for (let z = -1; z <= 1; z += 0.001) {
			const r = batRadius(z)
			if (r) expect(Math.hypot(r, z)).toBeLessThan(1)
			widest = Math.max(widest, r)
		}
		expect(widest).toBeCloseTo(BAT_RADIUS, 2)
	})

	test('has a knob, a thin handle and a thick barrel', () => {
		const knob = batRadius(-0.96)
		const handle = batRadius(-0.6)
		const barrel = batRadius(0.8)
		expect(knob).toBeGreaterThan(handle * 1.2)
		expect(barrel).toBeGreaterThan(handle * 1.8)
		expect(barrel).toBeCloseTo(BAT_RADIUS, 1)
	})

	test('tapers steadily from the handle to the barrel', () => {
		let last = 0
		for (let z = -0.8; z <= 0.7; z += 0.05) {
			expect(batRadius(z)).toBeGreaterThanOrEqual(last - 1e-9)
			last = batRadius(z)
		}
	})
})

describe('intersectBat', () => {
	test('meets the surface at its radius, facing out', () => {
		for (const z of [-0.7, -0.2, 0.4, 0.75]) {
			const h = side(z, [0, -1, 0])!
			expect(h).not.toBeNull()
			expect(h.ny).toBeLessThan(-0.95)
		}
	})

	test('misses beside the bat', () => {
		expect(intersectBat(2, BAT_RADIUS * 1.05, 0.5, -1, 0, 0, hit)).toBe(false)
		expect(intersectBat(0, 0, 2, 0, 0, 1, hit)).toBe(false)
	})

	test('has a cupped end', () => {
		// Down the axis, the bottom of the cup faces straight out
		expect(intersectBat(0, 0, 2, 0, 0, -1, hit)).toBe(true)
		expect(hit.nz).toBeCloseTo(1, 6)
		// Just off the axis, the dish leans back toward it, which only a hollow does
		expect(intersectBat(0.02, 0, 2, 0, 0, -1, hit)).toBe(true)
		expect(hit.nx).toBeLessThan(-0.3)
		expect(hit.nz).toBeGreaterThan(0.5)
	})

	test('wears tape on the handle, wood on the barrel, and the logo on one side', () => {
		expect(side(-0.6)!.material).toBe(TAPE)
		expect(side(0.6)!.material).toBe(WOOD)
		expect(side(0.6, [-1, 0, 0])!.material).toBe(WOOD)
		const logo = [0.2, 0.25, 0.3].map((z) => side(z)!.material)
		expect(logo).toContain(LOGO)
		expect([0.2, 0.25, 0.3].map((z) => side(z, [-1, 0, 0])!.material)).not.toContain(LOGO)
	})
})

describe('BAT', () => {
	test('never points at the viewer while it idles', () => {
		let state = BAT.start(() => 0.37)
		for (let t = 0; t < 14; t += 0.1) {
			const axis = apply(rotationMatrix(state.orientation), [0, 0, 1])
			expect(Math.abs(axis[2])).toBeLessThan(0.75)
			state = advance(state.orientation, state.spin, 0.1)
		}
	})
})
