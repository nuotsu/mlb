/// <reference types="bun" />

import { beforeAll, describe, expect, test } from 'bun:test'
import {
	castLocal,
	cross,
	normalize,
	randomOrientation,
	rotationMatrix,
	type Hit,
	type Vec3,
} from './ascii-3d'
import {
	BLACK,
	clearance,
	fieldDistance,
	GLOVE,
	GLOVE_BOX,
	intersectGlove,
	LACE,
	loadGlove,
	MAROON,
	OPENING,
	prepareGlove,
	PRINT,
	surfaceAt,
	viewGlove,
} from './baseball-glove'
import { ORIGIN, SIZE, VOXEL } from './baseball-glove-data'

/** Deterministic PRNG so failures reproduce. */
function seeded(seed = 1) {
	return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

const inBox = (p: number[]) => p.every((v, i) => v >= GLOVE_BOX.min[i] && v <= GLOVE_BOX.max[i])

/** Where a ray from in front through `(x, y)` first meets the glove (its z), by a fine march. */
function depth(x: number, y: number) {
	for (let z = GLOVE_BOX.max[2]; z >= GLOVE_BOX.min[2]; z -= 0.002)
		if (fieldDistance(x, y, z) < 0) return z
	return -Infinity
}

/** Every grid sample, as a point and its distance. */
function* samples() {
	const [nx, ny, nz] = SIZE
	for (let k = 0; k < nz; k++)
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++) {
				const p: Vec3 = [ORIGIN[0] + i * VOXEL, ORIGIN[1] + j * VOXEL, ORIGIN[2] + k * VOXEL]
				yield { p, d: fieldDistance(...p) }
			}
}

beforeAll(() => loadGlove())

describe('loading', () => {
	test('loads once, after which it’s ready', async () => {
		expect(loadGlove()).toBe(loadGlove())
		await loadGlove()
		expect(prepareGlove()).toBe(true)
		expect(GLOVE.prepare!(0)).toBe(true)
	})

	test('fits in the unit sphere, and in its box', () => {
		let farthest = 0
		for (const { p, d } of samples()) {
			if (d >= 0) continue
			farthest = Math.max(farthest, Math.hypot(...p))
			expect(inBox(p)).toBe(true)
		}
		// Within a sample of the sphere, but not past it
		expect(farthest).toBeLessThan(1)
		expect(farthest).toBeGreaterThan(0.9)
	})
})

describe('shape', () => {
	test('is cupped: the middle of the pocket sits well behind its rim', () => {
		expect(depth(0, 0)).toBeLessThan(-0.3)
		let rim = -Infinity
		for (let a = 0; a < 2 * Math.PI; a += Math.PI / 16)
			rim = Math.max(rim, depth(0.6 * Math.cos(a), 0.6 * Math.sin(a)))
		expect(rim).toBeGreaterThan(0.4)
	})

	test('sphere tracing finds where a fine march does, and never claims more room than there is', () => {
		const random = seeded(9)
		const hit: Hit = { nx: 0, ny: 0, nz: 0, material: -1 }
		let checked = 0
		while (checked < 300) {
			const z = random() * 2 - 1,
				a = random() * 2 * Math.PI,
				r = Math.sqrt(1 - z * z)
			const d = [r * Math.cos(a), r * Math.sin(a), z]
			const o = GLOVE_BOX.min.map((lo, i) => lo + random() * (GLOVE_BOX.max[i] - lo))
			const at = (t: number) => o.map((v, i) => v + d[i] * t) as Vec3
			if (fieldDistance(...at(0)) <= 0) continue
			let surface = Infinity
			for (let t = 0; inBox(at(t)); t += 0.002)
				if (fieldDistance(...at(t)) < 0) {
					surface = t
					break
				}
			if (surface === Infinity) continue
			checked++
			expect(intersectGlove(o[0], o[1], o[2], d[0], d[1], d[2], hit)).toBe(true)
			// Facing the ray, even grazing an edge
			expect(hit.nx * d[0] + hit.ny * d[1] + hit.nz * d[2]).toBeLessThan(1e-9)
			// The tracer trusts 90% of what the field says
			for (let t = 0; t < surface; t += 0.01)
				expect(fieldDistance(...at(t)) * 0.9).toBeLessThanOrEqual(surface - t + 0.001)
		}
	})

	test('a cone never claims to be clear past where any ray inside it meets the glove', () => {
		const random = seeded(4)
		const r = 0.05
		let checked = 0
		while (checked < 100) {
			const d = normalize([random() - 0.5, random() - 0.5, random() - 0.5])
			// Two directions across the cone
			const u = normalize(cross(d, Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]))
			const v = cross(d, u)
			const o = d.map((c) => -2 * c + (random() - 0.5)) as Vec3
			const clear = clearance(...o, ...d, r)
			if (clear === Infinity) continue
			checked++
			for (let a = 0; a < 2 * Math.PI; a += Math.PI / 4)
				for (const rho of [0, r / 2, r]) {
					const p = o.map((c, i) => c + rho * (Math.cos(a) * u[i] + Math.sin(a) * v[i]))
					for (let t = 0; t < clear - 0.002; t += 0.004)
						expect(fieldDistance(...(p.map((c, i) => c + t * d[i]) as Vec3))).toBeGreaterThan(0)
				}
		}
	})

	test('casting a patch at a time draws what casting every ray alone does', () => {
		const random = seeded(6)
		const a: Hit = { nx: 0, ny: 0, nz: 0, material: -1 },
			b: Hit = { nx: 0, ny: 0, nz: 0, material: -1 }
		let samples = 0,
			outline = 0,
			turned = 0
		for (let n = 0; n < 12; n++) {
			const m = rotationMatrix(randomOrientation(random))
			const patches = viewGlove(m, 0.07),
				rays = castLocal(m, intersectGlove)
			for (let x = -1; x <= 1; x += 0.013)
				for (let y = -1; y <= 1; y += 0.021) {
					if (x * x + y * y > 1) continue
					samples++
					const hitA = patches(x, y, a),
						hitB = rays(x, y, b)
					if (hitA !== hitB) outline++
					else if (hitA && a.nx * b.nx + a.ny * b.ny + a.nz * b.nz < 0.9) turned++
				}
		}
		// The same outline, but for the odd sample grazing an edge
		expect(outline / samples).toBeLessThan(0.0005)
		// Starting from elsewhere lands elsewhere within a hit's reach, which turns the normal on a
		// crease now and then
		expect(turned / samples).toBeLessThan(0.005)
	})

	test('misses around it', () => {
		const hit: Hit = { nx: 0, ny: 0, nz: 0, material: -1 }
		expect(intersectGlove(0.99, 0.99, 2, 0, 0, -1, hit)).toBe(false)
		expect(intersectGlove(-2, -0.99, -0.99, 1, 0, 0, hit)).toBe(false)
	})
})

describe('surfaces', () => {
	test('black and maroon leather, laces, and the hand opening, but no logos', () => {
		const seen = new Set<number>()
		for (const { p, d } of samples()) if (Math.abs(d) < VOXEL) seen.add(surfaceAt(...p))
		expect([...seen].sort()).toEqual([BLACK, MAROON, LACE, OPENING])
		expect(seen.has(PRINT)).toBe(false)
	})

	test('a black palm in the pocket, ringed by laces', () => {
		const hit: Hit = { nx: 0, ny: 0, nz: 0, material: -1 }
		const count = (r0: number, r1: number) => {
			const kinds = new Map<number, number>()
			for (let x = -1; x <= 1; x += 0.02)
				for (let y = -1; y <= 1; y += 0.02) {
					const r = Math.hypot(x, y)
					if (r < r0 || r > r1 || !intersectGlove(x, y, 2, 0, 0, -1, hit)) continue
					kinds.set(hit.material, (kinds.get(hit.material) ?? 0) + 1)
				}
			return kinds
		}
		const pocket = count(0, 0.3)
		expect(pocket.get(BLACK)! / [...pocket.values()].reduce((a, b) => a + b)).toBeGreaterThan(0.8)
		expect(count(0.5, 1).get(LACE)).toBeGreaterThan(20)
	})

	test('laces are drawn as thread, and the opening dark', () => {
		expect(GLOVE.materials[LACE].sewnInto).toBe(MAROON)
		expect(GLOVE.materials[OPENING].albedo).toBeLessThan(0.2)
		expect(GLOVE.materials[BLACK].albedo).toBeLessThan(GLOVE.materials[MAROON].albedo)
	})
})

test('credits the scan it’s made from', () => {
	const { credit } = GLOVE
	expect(credit?.author).toBe('Lead Black Tech')
	expect(credit?.license).toBe('CC BY 4.0')
	for (const url of [credit!.source, credit!.authorUrl, credit!.licenseUrl])
		expect(url).toStartWith('https://')
})
