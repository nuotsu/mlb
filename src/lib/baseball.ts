/**
 * Geometry, shading and spin physics for the homepage's ASCII baseball (`#ui/baseball.svelte`).
 *
 * Coordinates are in ball radii. World space is the viewer's: +x right, +y up, +z toward the
 * viewer. The ball's orientation is a unit quaternion taking ball-local coordinates to world.
 */

export type Vec3 = [number, number, number]

/** Unit quaternion `[w, x, y, z]`. */
export type Quat = [number, number, number, number]

/** Row-major 3×3 matrix. */
export type Mat3 = [number, number, number, number, number, number, number, number, number]

// --- Vectors & quaternions ---

export function dot(a: Vec3, b: Vec3) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
	return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function scale(v: Vec3, s: number): Vec3 {
	return [v[0] * s, v[1] * s, v[2] * s]
}

export function length(v: Vec3) {
	return Math.sqrt(dot(v, v))
}

export function normalize(v: Vec3): Vec3 {
	const len = length(v)
	return len > 0 ? scale(v, 1 / len) : [0, 0, 0]
}

/** Quaternion for a rotation vector (axis × angle in radians). */
export function quatFromRotation(v: Vec3): Quat {
	const angle = length(v)
	if (angle < 1e-12) return [1, 0, 0, 0]
	const s = Math.sin(angle / 2) / angle
	return [Math.cos(angle / 2), v[0] * s, v[1] * s, v[2] * s]
}

/** Hamilton product: the rotation `b` followed by `a`. */
export function quatMul(a: Quat, b: Quat): Quat {
	return [
		a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
		a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
		a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
		a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
	]
}

export function quatNormalize(q: Quat): Quat {
	const len = Math.hypot(q[0], q[1], q[2], q[3])
	return [q[0] / len, q[1] / len, q[2] / len, q[3] / len]
}

/** Rotation matrix for `q`; its transpose takes world coordinates back to ball-local ones. */
export function rotationMatrix([w, x, y, z]: Quat): Mat3 {
	return [
		1 - 2 * (y * y + z * z),
		2 * (x * y - w * z),
		2 * (x * z + w * y),
		2 * (x * y + w * z),
		1 - 2 * (x * x + z * z),
		2 * (y * z - w * x),
		2 * (x * z - w * y),
		2 * (y * z + w * x),
		1 - 2 * (x * x + y * y),
	]
}

/** Uniformly random orientation (Shoemake's method). */
export function randomOrientation(random = Math.random): Quat {
	const [u1, u2, u3] = [random(), random(), random()]
	const a = Math.sqrt(1 - u1)
	const b = Math.sqrt(u1)
	return [
		a * Math.sin(2 * Math.PI * u2),
		a * Math.cos(2 * Math.PI * u2),
		b * Math.sin(2 * Math.PI * u3),
		b * Math.cos(2 * Math.PI * u3),
	]
}

/** Rotation vector of the shortest rotation taking unit vector `from` onto unit vector `to`. */
export function rotationBetween(from: Vec3, to: Vec3): Vec3 {
	const axis = cross(from, to)
	const sin = length(axis)
	if (sin < 1e-12) return [0, 0, 0]
	return scale(axis, Math.atan2(sin, dot(from, to)) / sin)
}

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

// --- Shading ---

/** Key light from the upper left, slightly in front. */
export const LIGHT = normalize([-0.5, 0.6, 0.62])

const HALFWAY = normalize([LIGHT[0], LIGHT[1], LIGHT[2] + 1])

export interface Lighting {
	/** Ambient plus diffuse irradiance. */
	diffuse: number
	/** Blinn–Phong highlight. */
	specular: number
}

/** Lighting at world-space unit normal `n`, which stays put while the ball spins under it. */
export function lightingAt(n: Vec3): Lighting {
	// Wrapped Lambert softens the terminator the way leather's fuzz scatters light
	const lambert = Math.max(0, (dot(n, LIGHT) + 0.25) / 1.25)
	// Sky-ish ambient: a little brighter on the upper half
	const ambient = 0.12 + 0.06 * n[1]
	return {
		diffuse: ambient + 0.88 * lambert,
		specular: Math.pow(Math.max(0, dot(n, HALFWAY)), 18),
	}
}

const ALBEDO = [0.8, 0.4, 0.35] as const
const SHEEN = [0.16, 0, 0.05] as const

/** Brightness in `[0, 1]` of `surface` under `light`. */
export function shade(surface: Surface, { diffuse, specular }: Lighting) {
	return Math.min(1, ALBEDO[surface] * diffuse + SHEEN[surface] * specular)
}

// --- Spin physics ---

/** Spin (rad/s) the ball settles into on its own, about a turn every 12 seconds. */
export const IDLE_SPIN = 0.5

/** Fastest spin a fling can impart (rad/s). */
export const MAX_SPIN = 60

/** Air drag on the spin: dω/dt = −(k₁ω + k₂ω²) */
const LINEAR_DRAG = 0.5
const QUADRATIC_DRAG = 0.04

/**
 * Spin rate after `dt` seconds of air drag. Drag only bleeds off spin above `idle`; below it the
 * ball coasts. Uses the closed-form solution, so the result doesn't depend on the frame rate.
 */
export function decaySpin(speed: number, dt: number, idle = IDLE_SPIN) {
	const excess = speed - idle
	if (excess <= 0 || dt <= 0) return speed
	const k1 = LINEAR_DRAG,
		k2 = QUADRATIC_DRAG
	return idle + (k1 * excess) / ((k1 + k2 * excess) * Math.exp(k1 * dt) - k2 * excess)
}

/**
 * Advances a freely spinning ball by `dt` seconds. A sphere's inertia is the same about every
 * axis, so with no torque but drag its spin axis stays fixed in space and only the rate decays.
 */
export function advance(orientation: Quat, spin: Vec3, dt: number, idle = IDLE_SPIN) {
	const speed = length(spin)
	if (speed < 1e-9 || dt <= 0) return { orientation, spin }
	const next = decaySpin(speed, dt, idle)
	// Integrate the decaying rate exactly enough by rotating at the step's mean speed
	const angle = ((speed + next) / 2) * dt
	return {
		orientation: quatNormalize(quatMul(quatFromRotation(scale(spin, angle / speed)), orientation)),
		spin: scale(spin, next / speed),
	}
}

/**
 * Point on the ball under a pointer at `(x, y)` ball radii from its center (+y up). Off the
 * ball it continues onto a hyperbolic sheet (Bell's trackball), so dragging past the edge
 * keeps rolling the ball smoothly instead of jumping.
 */
export function sphereAt(x: number, y: number): Vec3 {
	const r2 = x * x + y * y
	const z = r2 <= 0.5 ? Math.sqrt(1 - r2) : 0.5 / Math.sqrt(r2)
	return normalize([x, y, z])
}

export interface RotationSample {
	/** Milliseconds. */
	time: number
	/** Rotation vector applied at `time`. */
	rotation: Vec3
}

/**
 * Angular velocity (rad/s) of a drag at its release: the rotation over the last `window` ms
 * divided by the time it took. Held still before letting go, the ball doesn't spin.
 */
export function releaseSpin(samples: RotationSample[], now: number, window = 100): Vec3 {
	const recent = samples.filter((s) => now - s.time <= window)
	if (!recent.length) return [0, 0, 0]
	const before = samples[samples.length - recent.length - 1]
	const start = before && now - before.time <= 2 * window ? before.time : recent[0].time - 16
	const total = recent.reduce<Vec3>(
		(sum, { rotation: r }) => [sum[0] + r[0], sum[1] + r[1], sum[2] + r[2]],
		[0, 0, 0],
	)
	const spin = scale(total, 1000 / Math.max(16, now - start))
	const speed = length(spin)
	return speed > MAX_SPIN ? scale(spin, MAX_SPIN / speed) : spin
}
