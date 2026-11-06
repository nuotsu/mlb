/**
 * Shared 3D math for the homepage's ASCII objects (`#ui/ascii-object.svelte`): vectors and
 * quaternions, lighting, spin physics, and the `Shape` each object implements.
 *
 * Coordinates are in object radii: every object fits in the unit sphere around the point it
 * spins about. World space is the viewer's: +x right, +y up, +z toward the viewer. An object's
 * orientation is a unit quaternion taking object-local coordinates to world.
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

/** Rotation matrix for `q`; its transpose takes world coordinates back to object-local ones. */
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

/** `m · v` */
export function apply(m: Mat3, v: Vec3): Vec3 {
	return [
		m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
		m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
		m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
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

/**
 * Lighting at the world-space unit normal `(nx, ny, nz)`. The light is fixed to the viewer, so
 * it stays put while the object spins under it. Writes into `out` to stay allocation-free in
 * the render loop.
 */
export function lightAt(
	nx: number,
	ny: number,
	nz: number,
	out: Lighting = { diffuse: 0, specular: 0 },
): Lighting {
	// Wrapped Lambert softens the terminator the way leather's fuzz scatters light
	const lambert = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2] + 0.25) / 1.25)
	// Sky-ish ambient: a little brighter on the upper half
	const ambient = 0.12 + 0.06 * ny
	out.diffuse = ambient + 0.88 * lambert
	out.specular = Math.pow(Math.max(0, nx * HALFWAY[0] + ny * HALFWAY[1] + nz * HALFWAY[2]), 18)
	return out
}

export function lightingAt(n: Vec3): Lighting {
	return lightAt(n[0], n[1], n[2])
}

export interface Material {
	/** Diffuse reflectance. */
	albedo: number
	/** Strength of the specular highlight. */
	sheen: number
	/**
	 * Thread, laces and the like: drawn in red when enough of a cell is covered, and otherwise
	 * shaded as the material (by index) they're sewn into.
	 */
	sewnInto?: number
}

/** Brightness in `[0, 1]` of `material` under `light`. */
export function shade({ albedo, sheen }: Material, { diffuse, specular }: Lighting) {
	return Math.min(1, albedo * diffuse + sheen * specular)
}

// --- Shapes ---

export interface Hit {
	/** World-space unit normal. */
	nx: number
	ny: number
	nz: number
	/** Index into the shape's `materials`. */
	material: number
}

/**
 * Casts the view ray through world `(x, y)` (it travels toward −z, orthographic), filling `hit`
 * with what it meets first. False when it misses.
 */
export type Cast = (x: number, y: number, hit: Hit) => boolean

/** A model someone else made, and the license it's shared under. */
export interface Credit {
	title: string
	/** Where it's published. */
	source: string
	author: string
	authorUrl: string
	license: string
	licenseUrl: string
}

export interface Shape {
	/** What it is, for screen readers ("baseball"). */
	name: string
	materials: readonly Material[]
	/** For a shape built from someone else's model: who to credit alongside it. */
	credit?: Credit
	/** Most orientations to blend for motion blur, when casting is costly. */
	blurSteps?: number
	/**
	 * One-time setup too slow for a single frame, done a slice at a time until `deadline` (a
	 * `performance.now()` time). True once the shape is ready to `view`.
	 */
	prepare?(deadline: number): boolean
	/** Orientation and spin (world rad/s) to start from. */
	start(random?: () => number): { orientation: Quat; spin: Vec3 }
	/**
	 * Prepares to cast rays at the object while its orientation matrix is `m`. `cell` is the
	 * longer side of a character cell in object radii, for detail that has to stay legible.
	 */
	view(m: Mat3, cell: number): Cast
}

/** World z the view rays start from: in front of anything inside the unit sphere. */
export const RAY_START = 2

/**
 * Intersects a ray `o + t·d` (object-local, `|d| = 1`) with a shape, writing the object-local
 * unit normal and material of the nearest hit into `hit`.
 */
export type Intersect = (
	ox: number,
	oy: number,
	oz: number,
	dx: number,
	dy: number,
	dz: number,
	hit: Hit,
) => boolean

/** A `Cast` for a shape that intersects rays in its own coordinates. */
export function castLocal(m: Mat3, intersect: Intersect): Cast {
	// World → local is mᵀ, so each world axis maps to the matching row of m
	const dx = -m[6],
		dy = -m[7],
		dz = -m[8]
	const zx = RAY_START * m[6],
		zy = RAY_START * m[7],
		zz = RAY_START * m[8]

	return (x, y, hit) => {
		const ox = x * m[0] + y * m[3] + zx,
			oy = x * m[1] + y * m[4] + zy,
			oz = x * m[2] + y * m[5] + zz
		if (!intersect(ox, oy, oz, dx, dy, dz, hit)) return false
		const { nx, ny, nz } = hit
		hit.nx = m[0] * nx + m[1] * ny + m[2] * nz
		hit.ny = m[3] * nx + m[4] * ny + m[5] * nz
		hit.nz = m[6] * nx + m[7] * ny + m[8] * nz
		return true
	}
}

// --- Rendering ---

/** Sub-cell sample points as fractions of a cell, where each glyph's shape is measured too. */
export const SUBSAMPLES: readonly (readonly [number, number])[] = [
	[0.25, 0.17],
	[0.75, 0.17],
	[0.25, 0.5],
	[0.75, 0.5],
	[0.25, 0.83],
	[0.75, 0.83],
]

/** Most orientations blended per frame for motion blur. */
export const MAX_BLUR_STEPS = 5

export interface Grid {
	cols: number
	rows: number
	/** A character cell's size, in object radii. */
	cellWidth: number
	cellHeight: number
}

export interface Frame {
	/** Ink per sub-sample, `(row * cols + col) * SUBSAMPLES.length + k`. */
	ink: Float64Array
	/** 1 for cells drawn as red thread. */
	stitch: Uint8Array
}

/** Orientations to blend for a frame that turned by the rotation vector `blur` while exposed. */
export function blurMatrices(
	orientation: Quat,
	blur: Vec3,
	cellWidth: number,
	maxSteps = MAX_BLUR_STEPS,
): Mat3[] {
	// Enough steps that no point on the rim moves more than half a cell between them
	const steps = Math.min(maxSteps, Math.max(1, Math.ceil(length(blur) / (0.5 * cellWidth))))
	return Array.from({ length: steps }, (_, k) =>
		rotationMatrix(quatMul(quatFromRotation(scale(blur, (k + 1) / steps - 1)), orientation)),
	)
}

/**
 * Renders `shape` seen in each of `matrices` (blended, for motion blur) into per-sample ink: light
 * on a dark page, shadow on a light one. Cells mostly covered by thread draw just the thread.
 */
export function renderFrame(
	shape: Shape,
	{ cols, rows, cellWidth, cellHeight }: Grid,
	matrices: Mat3[],
	dark: boolean,
): Frame {
	const n = SUBSAMPLES.length
	const ink = new Float64Array(cols * rows * n)
	const stitch = new Uint8Array(cols * rows)
	const casts = matrices.map((m) => shape.view(m, Math.max(cellWidth, cellHeight)))
	const steps = casts.length
	const { materials } = shape
	const hit: Hit = { nx: 0, ny: 0, nz: 1, material: 0 }
	const light: Lighting = { diffuse: 0, specular: 0 }
	const thread = new Float64Array(n)
	const threadLight = new Float64Array(n)

	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const cell = row * cols + col
			let threads = 0
			for (let k = 0; k < n; k++) {
				thread[k] = threadLight[k] = 0
				const x = (col + SUBSAMPLES[k][0] - cols / 2) * cellWidth
				const y = (rows / 2 - row - SUBSAMPLES[k][1]) * cellHeight
				// Everything fits in the unit sphere
				if (x * x + y * y > 1) continue

				let sum = 0
				for (const cast of casts) {
					if (!cast(x, y, hit)) continue
					lightAt(hit.nx, hit.ny, hit.nz, light)
					let material = materials[hit.material]
					// Count thread here; shade it as what it's sewn into unless enough of the cell is
					if (material.sewnInto !== undefined) {
						thread[k]++
						threadLight[k] += light.diffuse
						material = materials[material.sewnInto]
					}
					const brightness = shade(material, light)
					// Light text on dark draws light as ink; dark text on light draws shadow as ink,
					// with a floor so the lit side of a white object doesn't vanish into the page
					sum += dark ? brightness : 0.1 + 0.8 * (1 - brightness)
				}
				ink[cell * n + k] = sum / steps
				if (thread[k]) threadLight[k] /= thread[k]
				thread[k] /= steps
				threads += thread[k]
			}

			// Stitched cells draw just the thread, in red, so its shape picks the glyph. Red thread
			// is darker than leather, so on a light page it stays inky even in shadow
			if (threads / n > 0.12) {
				stitch[cell] = 1
				for (let k = 0; k < n; k++) {
					const lit = Math.min(1, threadLight[k])
					ink[cell * n + k] = thread[k] * (dark ? 0.3 + 0.45 * lit : 0.55 + 0.25 * (1 - lit))
				}
			}
		}
	}

	return { ink, stitch }
}

// --- Spin physics ---

/** Spin (rad/s) an object settles into on its own, about a turn every 12 seconds. */
export const IDLE_SPIN = 0.5

/** Fastest spin a fling can impart (rad/s). */
export const MAX_SPIN = 60

/** Air drag on the spin: dω/dt = −(k₁ω + k₂ω²) */
const LINEAR_DRAG = 0.5
const QUADRATIC_DRAG = 0.04

/**
 * Spin rate after `dt` seconds of air drag. Drag only bleeds off spin above `idle`; below it the
 * object coasts. Uses the closed-form solution, so the result doesn't depend on the frame rate.
 */
export function decaySpin(speed: number, dt: number, idle = IDLE_SPIN) {
	const excess = speed - idle
	if (excess <= 0 || dt <= 0) return speed
	const k1 = LINEAR_DRAG,
		k2 = QUADRATIC_DRAG
	return idle + (k1 * excess) / ((k1 + k2 * excess) * Math.exp(k1 * dt) - k2 * excess)
}

/**
 * Advances a freely spinning object by `dt` seconds. It's treated as having the same inertia
 * about every axis (exact for the ball), so with no torque but drag its spin axis stays fixed in
 * space and only the rate decays.
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
 * Point on the unit sphere under a pointer at `(x, y)` object radii from the center (+y up). Off
 * the sphere it continues onto a hyperbolic sheet (Bell's trackball), so dragging past the edge
 * keeps rolling the object smoothly instead of jumping.
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
 * divided by the time it took. Held still before letting go, the object doesn't spin.
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
