/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import {
	advance,
	apply,
	blurMatrices,
	castLocal,
	decaySpin,
	dot,
	IDLE_SPIN,
	length,
	LIGHT,
	lightAt,
	MAX_BLUR_STEPS,
	MAX_SPIN,
	quatFromRotation,
	randomOrientation,
	releaseSpin,
	renderFrame,
	rotationBetween,
	rotationMatrix,
	shade,
	sphereAt,
	SUBSAMPLES,
	type Hit,
	type Intersect,
	type Mat3,
	type Shape,
	type Vec3,
} from './ascii-3d'

/** Deterministic PRNG so failures reproduce. */
function seeded(seed = 1) {
	return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

function transpose(m: Mat3): Mat3 {
	return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]
}

const close = (a: Vec3, b: Vec3, digits = 9) =>
	a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits))

describe('lighting', () => {
	test('is brightest facing the light', () => {
		const lit = lightAt(...LIGHT).diffuse
		for (const n of [
			[0, 0, 1],
			[0, 1, 0],
			[1, 0, 0],
			[-1, 0, 0],
		] as Vec3[])
			expect(lightAt(...n).diffuse).toBeLessThan(lit)
	})

	test('leaves only ambient light on the far side', () => {
		const { diffuse, specular } = lightAt(-LIGHT[0], -LIGHT[1], -LIGHT[2])
		expect(diffuse).toBeLessThan(0.2)
		expect(specular).toBe(0)
	})

	test('shading stays in range', () => {
		const bright = shade({ albedo: 1, sheen: 1 }, lightAt(...LIGHT))
		expect(bright).toBeLessThanOrEqual(1)
		expect(shade({ albedo: 0.5, sheen: 0 }, { diffuse: 0, specular: 1 })).toBe(0)
	})
})

describe('castLocal', () => {
	// A ball of radius 0.5 centered at local (0.3, 0, 0)
	const ball: Intersect = (ox, oy, oz, dx, dy, dz, hit) => {
		const px = ox - 0.3
		const b = px * dx + oy * dy + oz * dz
		const disc = b * b - (px * px + oy * oy + oz * oz - 0.25)
		if (disc < 0) return false
		const t = -b - Math.sqrt(disc)
		hit.nx = (px + t * dx) / 0.5
		hit.ny = (oy + t * dy) / 0.5
		hit.nz = (oz + t * dz) / 0.5
		hit.material = 0
		return true
	}
	// A quarter turn about z takes local x to world y
	const cast = castLocal(rotationMatrix(quatFromRotation([0, 0, Math.PI / 2])), ball)
	const hit: Hit = { nx: 0, ny: 0, nz: 0, material: -1 }

	test('finds the object where its orientation puts it', () => {
		expect(cast(0, 0.3, hit)).toBe(true)
		close([hit.nx, hit.ny, hit.nz], [0, 0, 1])
		expect(cast(0.45, 0, hit)).toBe(false)
	})

	test('turns normals into world space', () => {
		expect(cast(0.2, 0.3, hit)).toBe(true)
		close([hit.nx, hit.ny, hit.nz], [0.4, 0, Math.sqrt(1 - 0.16)])
	})
})

describe('blurMatrices', () => {
	const orientation = randomOrientation(seeded(2))

	test('is just the orientation when it barely moved', () => {
		const [m, ...rest] = blurMatrices(orientation, [0, 0, 1e-4], 0.04)
		expect(rest).toHaveLength(0)
		m.forEach((v, i) => expect(v).toBeCloseTo(rotationMatrix(orientation)[i], 12))
	})

	test('steps through the exposure, ending at the orientation', () => {
		const steps = blurMatrices(orientation, [0, 0.05, 0], 0.04)
		expect(steps).toHaveLength(3)
		steps.at(-1)!.forEach((v, i) => expect(v).toBeCloseTo(rotationMatrix(orientation)[i], 12))
	})

	test('caps the steps', () => {
		expect(blurMatrices(orientation, [0, 5, 0], 0.04)).toHaveLength(MAX_BLUR_STEPS)
		expect(blurMatrices(orientation, [0, 5, 0], 0.04, 2)).toHaveLength(2)
	})
})

describe('renderFrame', () => {
	const grid = { cols: 12, rows: 7, cellWidth: 0.17, cellHeight: 0.3 }
	const n = SUBSAMPLES.length
	const identity = [rotationMatrix([1, 0, 0, 0])]

	/** Fills the unit disc with one material facing the viewer. */
	const disc = (material: number): Shape => ({
		name: 'disc',
		materials: [
			{ albedo: 0.6, sheen: 0 },
			{ albedo: 0.3, sheen: 0, sewnInto: 0 },
		],
		start: () => ({ orientation: [1, 0, 0, 0], spin: [0, 0, 0] }),
		view: () => (x, y, hit) => {
			if (x * x + y * y > 0.5) return false
			Object.assign(hit, { nx: 0, ny: 0, nz: 1, material })
			return true
		},
	})

	test('leaves blank what the rays miss', () => {
		const { ink, stitch } = renderFrame(disc(0), grid, identity, true)
		// The corners are outside the disc
		expect(ink.subarray(0, n).every((v) => v === 0)).toBe(true)
		expect(stitch.every((v) => v === 0)).toBe(true)
		expect(ink.some((v) => v > 0)).toBe(true)
	})

	test('draws light as ink on a dark page and shadow as ink on a light one', () => {
		const dark = renderFrame(disc(0), grid, identity, true).ink
		const light = renderFrame(disc(0), grid, identity, false).ink
		dark.forEach((v, i) => {
			if (v) expect(v + (light[i] - 0.1) / 0.8).toBeCloseTo(1, 12)
			else expect(light[i]).toBe(0)
		})
	})

	test('draws thread-covered cells as stitches', () => {
		const { stitch } = renderFrame(disc(1), grid, identity, true)
		const center = 3 * grid.cols + 6
		expect(stitch[center]).toBe(1)
		expect(stitch[0]).toBe(0)
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
