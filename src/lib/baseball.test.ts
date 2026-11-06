/// <reference types="bun" />

import { describe, expect, test } from 'bun:test'
import {
	blurMatrices,
	length,
	lightingAt,
	randomOrientation,
	renderFrame,
	SUBSAMPLES,
	type Mat3,
	type Vec3,
} from './ascii-3d'
import {
	BASEBALL,
	GROOVE,
	LEATHER,
	nearestSeam,
	REGULATION_STITCHES,
	SEAM_LENGTH,
	seamPoint,
	seamStyle,
	surfaceAt,
	THREAD,
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

describe('BASEBALL', () => {
	/*
	 * The renderer before it was shared between objects, condensed: per-sample sphere normals and
	 * lighting, the seam looked up per blur step, and thread shaded as leather unless the cell's
	 * mostly thread. The shared renderer must draw the ball the same way.
	 */
	const ALBEDO = [0.8, 0.4, 0.35]
	const SHEEN = [0.16, 0, 0.05]
	function original(
		cols: number,
		rows: number,
		cw: number,
		ch: number,
		radius: number,
		m: Mat3[],
		dark: boolean,
	) {
		const style = seamStyle(Math.max(cw, ch) / radius)
		const ink: number[] = []
		const stitch: number[] = []
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const cell: number[] = []
				const thread: number[] = []
				const diffuse: number[] = []
				let threads = 0
				SUBSAMPLES.forEach(([sx, sy], k) => {
					cell[k] = thread[k] = diffuse[k] = 0
					const x = ((col + sx - cols / 2) * cw) / radius
					const y = ((rows / 2 - row - sy) * ch) / radius
					if (x * x + y * y > 1) return
					const n: Vec3 = [x, y, Math.sqrt(1 - x * x - y * y)]
					const light = lightingAt(n)
					diffuse[k] = light.diffuse
					const shade = (s: number) =>
						Math.min(1, ALBEDO[s] * light.diffuse + SHEEN[s] * light.specular)
					let brightness = 0
					for (const r of m) {
						const s = surfaceAt(
							r[0] * n[0] + r[3] * n[1] + r[6] * n[2],
							r[1] * n[0] + r[4] * n[1] + r[7] * n[2],
							r[2] * n[0] + r[5] * n[1] + r[8] * n[2],
							style,
						)
						if (s === THREAD) thread[k]++
						else brightness += shade(s)
					}
					brightness = (brightness + thread[k] * shade(LEATHER)) / m.length
					thread[k] /= m.length
					threads += thread[k]
					cell[k] = dark ? brightness : 0.1 + 0.8 * (1 - brightness)
				})
				const isStitch = threads / SUBSAMPLES.length > 0.12
				if (isStitch)
					cell.forEach((_, k) => {
						const lit = Math.min(1, diffuse[k])
						cell[k] = thread[k] * (dark ? 0.3 + 0.45 * lit : 0.55 + 0.25 * (1 - lit))
					})
				ink.push(...cell)
				stitch.push(isStitch ? 1 : 0)
			}
		}
		return { ink, stitch }
	}

	test('draws exactly what the ball drew before', () => {
		const random = seeded(9)
		const [cols, rows, cw, ch] = [54, 30, 4.4, 8]
		const radius = (Math.min(cols * cw, rows * ch) / 2) * 0.94
		const grid = { cols, rows, cellWidth: cw / radius, cellHeight: ch / radius }
		for (const blur of [
			[0, 0, 0],
			[0.02, 0.06, 0],
		] as Vec3[]) {
			for (const dark of [true, false]) {
				const orientation = randomOrientation(random)
				const m = blurMatrices(orientation, blur, grid.cellWidth)
				const before = original(cols, rows, cw, ch, radius, m, dark)
				const after = renderFrame(BASEBALL, grid, m, dark)
				expect(Array.from(after.stitch)).toEqual(before.stitch)
				after.ink.forEach((v, i) => expect(v).toBeCloseTo(before.ink[i], 12))
			}
		}
	})

	test('starts at a random orientation, spinning at the idle rate', () => {
		const { orientation, spin } = BASEBALL.start(seeded(4))
		expect(Math.hypot(...orientation)).toBeCloseTo(1, 12)
		expect(length(spin)).toBeCloseTo(0.5, 12)
	})
})
