/**
 * The homepage's ASCII baseball (`#ui/ascii-object.svelte`): its seam, stitching and leather.
 *
 * Coordinates are in ball radii, in the ball's own frame (see `#lib/ascii-3d.js`).
 */

import {
	IDLE_SPIN,
	normalize,
	randomOrientation,
	scale,
	sphereAt,
	type Mat3,
	type Material,
	type Shape,
	type Vec3,
} from './ascii-3d.js'

// --- Seam ---

/*
 * A baseball's cover is two figure-8 pieces of leather stitched together. Their seam is closely
 * approximated by a closed curve on the unit sphere (the same family as a tennis ball's):
 *
 *   x = a cos t + b cos 3t,   y = a sin t − b sin 3t,   z = 2√(ab) sin 2t,   a + b = 1
 *
 * x² + y² + z² = 1 for every t, so the curve never leaves the surface, and the two halves it
 * splits the sphere into are congruent (a half-turn about z swaps them). `b` sets how narrow
 * the covers' waists are.
 */
const SEAM_B = 0.28
const SEAM_A = 1 - SEAM_B
const SEAM_C = 2 * Math.sqrt(SEAM_A * SEAM_B)

/** Coarse samples used to seed the nearest-point search. */
const SEAM_SAMPLES = 96
const SEAM_STEP = (2 * Math.PI) / SEAM_SAMPLES

export function seamPoint(t: number): Vec3 {
	return [
		SEAM_A * Math.cos(t) + SEAM_B * Math.cos(3 * t),
		SEAM_A * Math.sin(t) - SEAM_B * Math.sin(3 * t),
		SEAM_C * Math.sin(2 * t),
	]
}

const seamX = new Float64Array(SEAM_SAMPLES)
const seamY = new Float64Array(SEAM_SAMPLES)
const seamZ = new Float64Array(SEAM_SAMPLES)
/** Arc length from t = 0 to each coarse sample, plus the full loop at the end. */
const seamArc = new Float64Array(SEAM_SAMPLES + 1)
/** Longest chord between neighboring coarse samples. */
let seamGap = 0

{
	const sub = 64
	let prev = seamPoint(0)
	for (let i = 0; i < SEAM_SAMPLES; i++) {
		;[seamX[i], seamY[i], seamZ[i]] = prev
		let arc = 0
		for (let k = 1; k <= sub; k++) {
			const p = seamPoint((i + k / sub) * SEAM_STEP)
			arc += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2])
			prev = p
		}
		seamArc[i + 1] = seamArc[i] + arc
		seamGap = Math.max(seamGap, arc)
	}
}

/** Length of the seam, in ball radii (a regulation ball's is ~3.7 radii of its ~2.9" diameter). */
export const SEAM_LENGTH = seamArc[SEAM_SAMPLES]

/** Regulation baseballs have 108 double stitches. */
export const REGULATION_STITCHES = 108

export interface SeamHit {
	/** Chord distance from the point to the nearest point on the seam. */
	distance: number
	/** Arc length along the seam to that nearest point, in `[0, SEAM_LENGTH)`. */
	arc: number
}

/**
 * Nearest point on the seam to the unit vector `(x, y, z)`, or `null` when it's farther than
 * `maxDistance`. Writes into `out` to stay allocation-free in the render loop.
 */
export function nearestSeam(
	x: number,
	y: number,
	z: number,
	maxDistance: number,
	out: SeamHit = { distance: 0, arc: 0 },
): SeamHit | null {
	// Nearest coarse sample: on the unit sphere, |p − s|² = 2 − 2 p·s
	let best = 0
	let bestDot = -Infinity
	for (let i = 0; i < SEAM_SAMPLES; i++) {
		const d = x * seamX[i] + y * seamY[i] + z * seamZ[i]
		if (d > bestDot) {
			bestDot = d
			best = i
		}
	}

	const reject = maxDistance + seamGap / 2
	if (2 - 2 * bestDot > reject * reject) return null

	// Refine by Newton's method on f(t) = p·P(t), which peaks at the nearest point
	let t = best * SEAM_STEP
	for (let i = 0; i < 3; i++) {
		const c1 = Math.cos(t),
			s1 = Math.sin(t),
			c2 = Math.cos(2 * t),
			s2 = Math.sin(2 * t),
			c3 = Math.cos(3 * t),
			s3 = Math.sin(3 * t)
		const f1 =
			x * (-SEAM_A * s1 - 3 * SEAM_B * s3) +
			y * (SEAM_A * c1 - 3 * SEAM_B * c3) +
			z * (2 * SEAM_C * c2)
		const f2 =
			x * (-SEAM_A * c1 - 9 * SEAM_B * c3) +
			y * (-SEAM_A * s1 + 9 * SEAM_B * s3) +
			z * (-4 * SEAM_C * s2)
		if (f2 >= 0) break
		t -= Math.max(-SEAM_STEP, Math.min(SEAM_STEP, f1 / f2))
	}

	const [px, py, pz] = seamPoint(t)
	const distance = Math.sqrt(Math.max(0, 2 - 2 * (x * px + y * py + z * pz)))
	if (distance > maxDistance) return null

	t = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
	const i = Math.min(SEAM_SAMPLES - 1, Math.floor(t / SEAM_STEP))
	const f = t / SEAM_STEP - i
	out.distance = distance
	out.arc = seamArc[i] + (seamArc[i + 1] - seamArc[i]) * f
	return out
}

// --- Stitching ---

export const LEATHER = 0
export const GROOVE = 1
export const THREAD = 2
export type Surface = typeof LEATHER | typeof GROOVE | typeof THREAD

export interface SeamStyle {
	/** Half-width of the groove where the two covers meet. */
	groove: number
	/** How far each stitch reaches from the seam line. */
	reach: number
	/** Arc length between stitches. */
	spacing: number
	/** Lean of each stitch along the seam per unit away from it; mirrored on both sides into a V. */
	lean: number
	/** Arc length each stitch's thread covers. */
	thread: number
}

/**
 * Stitching proportioned like a regulation ball, coarsened when `cell` (the longer side of a
 * character cell, in ball radii) is too big to resolve it.
 */
export function seamStyle(cell: number): SeamStyle {
	const count = Math.max(
		16,
		Math.min(REGULATION_STITCHES, Math.floor(SEAM_LENGTH / (2.2 * cell) / 2) * 2),
	)
	const spacing = SEAM_LENGTH / count
	return {
		groove: Math.max(0.015, 0.3 * cell),
		reach: Math.max(0.11, 1.2 * cell),
		spacing,
		lean: 1,
		thread: spacing * 0.32,
	}
}

/*
 * The seam is fixed to the ball, so nearest-seam lookups are cached in a cube map over the
 * ball-local sphere, filled lazily as each texel first comes into view. A texel spans at most
 * 2/CUBE_SIZE radians, finer than the grid's sub-cell samples.
 */
const CUBE_SIZE = 192
/** Farther than any style's `reach`; beyond it a texel just records "no seam nearby". */
const CUBE_REACH = 0.5
const cubeDistance = new Float32Array(6 * CUBE_SIZE * CUBE_SIZE).fill(NaN)
const cubeArc = new Float32Array(6 * CUBE_SIZE * CUBE_SIZE)
const cubeHit: SeamHit = { distance: 0, arc: 0 }

/** Index of the cube-map texel containing the ball-local unit vector `(x, y, z)`. */
function cubeTexel(x: number, y: number, z: number) {
	const ax = Math.abs(x),
		ay = Math.abs(y),
		az = Math.abs(z)
	let face: number, u: number, v: number
	if (ax >= ay && ax >= az) {
		face = x > 0 ? 0 : 1
		u = y / ax
		v = z / ax
	} else if (ay >= az) {
		face = y > 0 ? 2 : 3
		u = x / ay
		v = z / ay
	} else {
		face = z > 0 ? 4 : 5
		u = x / az
		v = y / az
	}
	const i = Math.min(CUBE_SIZE - 1, Math.floor(((u + 1) / 2) * CUBE_SIZE))
	const j = Math.min(CUBE_SIZE - 1, Math.floor(((v + 1) / 2) * CUBE_SIZE))
	return (face * CUBE_SIZE + j) * CUBE_SIZE + i
}

/** Fills a texel from the exact search, run at the texel's center. */
function fillTexel(texel: number) {
	const face = Math.floor(texel / (CUBE_SIZE * CUBE_SIZE))
	const u = (((texel % CUBE_SIZE) + 0.5) / CUBE_SIZE) * 2 - 1
	const v = (((Math.floor(texel / CUBE_SIZE) % CUBE_SIZE) + 0.5) / CUBE_SIZE) * 2 - 1
	const sign = face % 2 ? -1 : 1
	const [x, y, z] = normalize(face < 2 ? [sign, u, v] : face < 4 ? [u, sign, v] : [u, v, sign])
	const hit = nearestSeam(x, y, z, CUBE_REACH, cubeHit)
	cubeDistance[texel] = hit ? hit.distance : Infinity
	cubeArc[texel] = hit ? hit.arc : 0
}

/** What covers the ball at the ball-local unit vector `(x, y, z)`. */
export function surfaceAt(x: number, y: number, z: number, style: SeamStyle): Surface {
	const texel = cubeTexel(x, y, z)
	if (Number.isNaN(cubeDistance[texel])) fillTexel(texel)
	const distance = cubeDistance[texel]
	if (distance > style.reach) return LEATHER
	if (distance < style.groove) return GROOVE

	// Each stitch runs from the groove out to `reach`, leaning back along the seam on both
	// sides, so neighboring stitches read as a chain of V's
	const along = cubeArc[texel] - style.lean * (distance - style.groove)
	const phase = along - Math.floor(along / style.spacing) * style.spacing
	return phase < style.thread ? THREAD : LEATHER
}

// --- Shape ---

/** Indexed by `Surface`. Thread is shaded as the leather it's sewn into unless it's drawn red. */
const MATERIALS: Material[] = [
	{ albedo: 0.8, sheen: 0.16 },
	{ albedo: 0.4, sheen: 0 },
	{ albedo: 0.35, sheen: 0.05, sewnInto: LEATHER },
]

export const BASEBALL: Shape = {
	name: 'baseball',
	materials: MATERIALS,

	start(random = Math.random) {
		return {
			orientation: randomOrientation(random),
			spin: scale(sphereAt(random() * 2 - 1, random() * 2 - 1), IDLE_SPIN),
		}
	},

	view(m: Mat3, cell: number) {
		const style = seamStyle(cell)
		// A sphere's silhouette and normals don't depend on how it's turned, only what's on it
		return (x, y, hit) => {
			const r2 = x * x + y * y
			if (r2 > 1) return false
			const z = Math.sqrt(1 - r2)
			hit.nx = x
			hit.ny = y
			hit.nz = z
			// World → ball-local is the transpose of the orientation matrix
			hit.material = surfaceAt(
				m[0] * x + m[3] * y + m[6] * z,
				m[1] * x + m[4] * y + m[7] * z,
				m[2] * x + m[5] * y + m[8] * z,
				style,
			)
			return true
		}
	},
}
