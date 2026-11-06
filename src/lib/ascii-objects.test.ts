/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import { IDLE_SPIN, length, randomOrientation, rotationMatrix, type Hit } from './ascii-3d'
import { ASCII_OBJECT_IDS, ASCII_OBJECTS, isAsciiObjectId, pickAsciiObject } from './ascii-objects'

/** Deterministic PRNG so failures reproduce. */
function seeded(seed = 1) {
	return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

describe('pickAsciiObject', () => {
	test('picks each object about equally often', () => {
		const random = seeded(5)
		const counts = Object.fromEntries(ASCII_OBJECT_IDS.map((id) => [id, 0]))
		for (let i = 0; i < 8000; i++) counts[pickAsciiObject(random)]++
		for (const id of ASCII_OBJECT_IDS) expect(counts[id] / 8000).toBeCloseTo(0.25, 1)
	})

	test('maps the whole range of random numbers onto the objects', () => {
		expect(pickAsciiObject(() => 0)).toBe('ball')
		expect(pickAsciiObject(() => 0.999999)).toBe('plate')
		// Out of `Math.random`'s range, but a stub might return it
		expect(pickAsciiObject(() => 1)).toBe('plate')
	})

	test('takes a forced object, but only a real one', () => {
		expect(pickAsciiObject(() => 0, 'glove')).toBe('glove')
		expect(pickAsciiObject(() => 0, 'catcher')).toBe('ball')
		expect(pickAsciiObject(() => 0, null)).toBe('ball')
		expect(isAsciiObjectId('bat')).toBe(true)
		expect(isAsciiObjectId('toString')).toBe(false)
	})
})

describe.each(ASCII_OBJECT_IDS)('%s', (id) => {
	const shape = ASCII_OBJECTS[id]
	shape.prepare?.(Infinity)
	const hit: Hit = { nx: 0, ny: 0, nz: 0, material: -1 }

	test('names itself for screen readers', () => {
		expect(shape.name).toMatch(/^(baseball|home plate)/)
	})

	test('starts spinning at the idle rate', () => {
		const { orientation, spin } = shape.start(seeded(2))
		expect(Math.hypot(...orientation)).toBeCloseTo(1, 12)
		expect(length(spin)).toBeCloseTo(IDLE_SPIN, 12)
	})

	test('stays inside the unit sphere however it turns', () => {
		const random = seeded(8)
		for (let i = 0; i < 40; i++) {
			const cast = shape.view(rotationMatrix(randomOrientation(random)), 0.04)
			for (let a = 0; a < 2 * Math.PI; a += Math.PI / 32)
				expect(cast(1.0001 * Math.cos(a), 1.0001 * Math.sin(a), hit)).toBe(false)
		}
	})

	test('is in plain view as it starts', () => {
		const cast = shape.view(rotationMatrix(shape.start(seeded(3)).orientation), 0.04)
		let hits = 0,
			total = 0
		for (let x = -1; x <= 1; x += 0.02)
			for (let y = -1; y <= 1; y += 0.02) {
				if (x * x + y * y > 1) continue
				total++
				if (cast(x, y, hit)) {
					hits++
					expect(Math.hypot(hit.nx, hit.ny, hit.nz)).toBeCloseTo(1, 6)
					expect(hit.nz).toBeGreaterThan(-0.05)
					expect(shape.materials[hit.material]).toBeDefined()
				}
			}
		// Even the slender bat covers a tenth of it
		expect(hits / total).toBeGreaterThan(0.08)
	})
})
