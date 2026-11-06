/**
 * The homepage's ASCII baseball glove (`#ui/ascii-object.svelte`), from a 3D scan of a Rawlings
 * Players Series youth glove in black and maroon leather with white laces: "Baseball Glove" by
 * Lead Black Tech (https://sketchfab.com/drebond), licensed CC BY 4.0
 * (https://sketchfab.com/3d-models/baseball-glove-35b2e174e07047f4a7d3442b5ed921c0).
 *
 * `scripts/bake-glove.ts` samples the scan's signed distance into a grid, with the kind of surface
 * nearest each sample, into `./baseball-glove-data.ts`. That's loaded the first time the glove is
 * shown, and the grid is sphere-traced with trilinear lookups.
 *
 * In object space +y runs up the fingers, −x toward the thumb, and +z out of the pocket: a glove
 * for a left hand, seen from the front.
 */

import {
	IDLE_SPIN,
	MAX_BLUR_STEPS,
	normalize,
	quatFromRotation,
	quatMul,
	RAY_START,
	scale,
	type Cast,
	type Credit,
	type Hit,
	type Intersect,
	type Mat3,
	type Material,
	type Shape,
	type Vec3,
} from './ascii-3d.js'

/** Kinds of surface, as the bake numbers them. */
export const BLACK = 0
export const MAROON = 1
export const LACE = 2
export const PRINT = 3
export const OPENING = 4

const MATERIALS: Material[] = [
	// Black leather: the palm, the web and the back of the hand. Lighter than it is, so it reads
	// on a dark page, but a step down from the maroon so the panels show
	{ albedo: 0.62, sheen: 0.3 },
	// Maroon leather: the finger stalls and the thumb
	{ albedo: 0.95, sheen: 0.2 },
	// Rawhide laces: drawn red where they cover enough of a cell
	{ albedo: 0.9, sheen: 0.1, sewnInto: MAROON },
	// The silver logos, though the bake gives them the leather's kind: they're too small to make
	// out in type
	{ albedo: 1, sheen: 0.3 },
	// The hand opening (the stand the glove was scanned on shows in it)
	{ albedo: 0.1, sheen: 0 },
]

export const GLOVE_CREDIT: Credit = {
	title: 'Baseball Glove',
	source: 'https://sketchfab.com/3d-models/baseball-glove-35b2e174e07047f4a7d3442b5ed921c0',
	author: 'Lead Black Tech',
	authorUrl: 'https://sketchfab.com/drebond',
	license: 'CC BY 4.0',
	licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
}

// --- The grid ---

/**
 * The grid, once loaded: its size, where its first sample sits, and the signed distance and kind
 * of surface at each sample. Held in one object: hot loops read an object's fields faster than
 * module-level bindings.
 */
const GRID = {
	x0: 0,
	y0: 0,
	z0: 0,
	nx: 0,
	ny: 0,
	nz: 0,
	scale: 1,
	values: new Float32Array(0),
	surfaces: new Uint8Array(0),
}

/** Where the grid's samples reach, a voxel in from its edges (where the empty padding starts). */
export const GLOVE_BOX = { min: [0, 0, 0] as Vec3, max: [0, 0, 0] as Vec3 }

let loading: Promise<void> | undefined
let ready = false

/**
 * Fetches and unpacks the grid (a separate chunk, so it only loads for the glove). Resolves once
 * it's ready.
 */
export function loadGlove(): Promise<void> {
	loading ??= import('./baseball-glove-data.js')
		.then(async ({ SIZE, ORIGIN, VOXEL, STEP, LIMIT, DATA }) => {
			const packed = Uint8Array.from(atob(DATA), (c) => c.charCodeAt(0))
			const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
			const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
			const [nx, ny, nz] = SIZE
			const count = nx * ny * nz
			const values = new Float32Array(count)
			// Each distance is stored as the change from the sample before it along x
			for (let n = 0, last = 0; n < count; n++) {
				const delta = (bytes[n] << 24) >> 24
				last = n % nx ? last + delta : delta
				values[n] = last * STEP
			}
			reachFarther(values, nx, ny, nz, VOXEL, LIMIT * STEP, STEP)
			Object.assign(GRID, {
				x0: ORIGIN[0],
				y0: ORIGIN[1],
				z0: ORIGIN[2],
				nx,
				ny,
				nz,
				scale: 1 / VOXEL,
				values,
				surfaces: bytes.slice(count, count * 2),
			})
			for (let i = 0; i < 3; i++) {
				GLOVE_BOX.min[i] = ORIGIN[i] + VOXEL
				GLOVE_BOX.max[i] = ORIGIN[i] + (SIZE[i] - 2) * VOXEL
			}
			ready = true
		})
		.catch((error) => {
			// Try again later (say, back online)
			setTimeout(() => (loading = undefined), 5000)
			throw error
		})
	return loading
}

/** Stands in for "infinitely far" in squared voxel distances, finite so the arithmetic holds. */
const FAR = 1e20

/**
 * The squared distance transform of one line (Felzenszwalb and Huttenlocher's): for each sample,
 * the least of `(q − p)² + f[p]` over all `p`. Reads `n` samples from `f` at `start` with `stride`,
 * writes them back in place.
 */
function transformLine(
	f: Float64Array,
	start: number,
	stride: number,
	n: number,
	line: Float64Array,
	v: Int32Array,
	z: Float64Array,
) {
	for (let q = 0; q < n; q++) line[q] = f[start + q * stride]
	let k = 0
	v[0] = 0
	z[0] = -Infinity
	z[1] = Infinity
	for (let q = 1; q < n; q++) {
		let p = v[k]
		let cross = (line[q] + q * q - (line[p] + p * p)) / (2 * (q - p))
		while (cross <= z[k]) {
			k--
			p = v[k]
			cross = (line[q] + q * q - (line[p] + p * p)) / (2 * (q - p))
		}
		k++
		v[k] = q
		z[k] = cross
		z[k + 1] = Infinity
	}
	k = 0
	for (let q = 0; q < n; q++) {
		while (z[k + 1] < q) k++
		const p = v[k]
		f[start + q * stride] = (q - p) * (q - p) + line[p]
	}
}

/**
 * Distances are only stored out to `limit`, which would keep sphere tracing to short steps. Every
 * point of the surface is within half a cell's diagonal of a sample that's that close to it, so
 * the straight-line distance to the nearest such sample, less that, never overstates the distance
 * to the glove. Fill in that, past the limit, less another half voxel for trilinear lookups
 * between samples (the tests check how far those can overstate it).
 */
function reachFarther(
	values: Float32Array,
	nx: number,
	ny: number,
	nz: number,
	voxel: number,
	limit: number,
	step: number,
) {
	const near = (Math.sqrt(3) / 2) * voxel + step / 2
	const squared = new Float64Array(values.length)
	for (let i = 0; i < values.length; i++) squared[i] = Math.abs(values[i]) <= near ? 0 : FAR
	const longest = Math.max(nx, ny, nz)
	const line = new Float64Array(longest),
		v = new Int32Array(longest),
		z = new Float64Array(longest + 1)
	for (let k = 0; k < nz; k++)
		for (let j = 0; j < ny; j++) transformLine(squared, (k * ny + j) * nx, 1, nx, line, v, z)
	for (let k = 0; k < nz; k++)
		for (let i = 0; i < nx; i++) transformLine(squared, k * ny * nx + i, nx, ny, line, v, z)
	for (let j = 0; j < ny; j++)
		for (let i = 0; i < nx; i++) transformLine(squared, j * nx + i, nx * ny, nz, line, v, z)
	const slack = near + voxel / 2
	for (let i = 0; i < values.length; i++) {
		if (values[i] < limit) continue
		const far = Math.sqrt(squared[i]) * voxel - slack
		if (far > values[i]) values[i] = far
	}
}

/** True once the grid is loaded; until then, starts loading it. */
export function prepareGlove() {
	if (!ready && !loading) loadGlove().catch(() => {})
	return ready
}

/** Gradient of the grid's distance where `fieldDistance` was last called `withGradient`. */
const gradient: Vec3 = [0, 0, 0]

/**
 * Distance to the glove from `(x, y, z)` (object radii, inside its box), from the grid. With
 * `withGradient`, also leaves the field's gradient in `gradient`, from the same eight samples.
 */
export function fieldDistance(x: number, y: number, z: number, withGradient = false) {
	const { x0, y0, z0, nx, ny, nz, scale, values: f } = GRID
	let fx = (x - x0) * scale,
		fy = (y - y0) * scale,
		fz = (z - z0) * scale
	fx = fx < 0 ? 0 : fx > nx - 1.001 ? nx - 1.001 : fx
	fy = fy < 0 ? 0 : fy > ny - 1.001 ? ny - 1.001 : fy
	fz = fz < 0 ? 0 : fz > nz - 1.001 ? nz - 1.001 : fz
	const i = fx | 0,
		j = fy | 0,
		k = fz | 0
	const tx = fx - i,
		ty = fy - j,
		tz = fz - k
	const a = (k * ny + j) * nx + i
	const b = a + nx * ny
	const v000 = f[a],
		v100 = f[a + 1],
		v010 = f[a + nx],
		v110 = f[a + nx + 1],
		v001 = f[b],
		v101 = f[b + 1],
		v011 = f[b + nx],
		v111 = f[b + nx + 1]
	const c00 = v000 + (v100 - v000) * tx
	const c10 = v010 + (v110 - v010) * tx
	const c01 = v001 + (v101 - v001) * tx
	const c11 = v011 + (v111 - v011) * tx
	const c0 = c00 + (c10 - c00) * ty
	const c1 = c01 + (c11 - c01) * ty
	if (withGradient) {
		const dx0 = v100 - v000 + (v110 - v010 - v100 + v000) * ty
		const dx1 = v101 - v001 + (v111 - v011 - v101 + v001) * ty
		gradient[0] = (dx0 + (dx1 - dx0) * tz) * scale
		gradient[1] = (c10 - c00 + (c11 - c01 - c10 + c00) * tz) * scale
		gradient[2] = (c1 - c0) * scale
	}
	return c0 + (c1 - c0) * tz
}

/** The kind of surface at `(x, y, z)`, on or near the glove: the nearest sample's. */
export function surfaceAt(x: number, y: number, z: number) {
	const { x0, y0, z0, nx, ny, scale, surfaces } = GRID
	const i = Math.round((x - x0) * scale),
		j = Math.round((y - y0) * scale),
		k = Math.round((z - z0) * scale)
	return surfaces[(k * ny + j) * nx + i]
}

// --- Tracing ---

const MAX_STEPS = 64
/** Close enough to call a hit: a fraction of the spacing between sub-samples. */
const EPSILON = 0.004
/** Trilinear lookups of a distance only approximate one, so trust it this much. */
const SAFE = 0.9
/** Over-relaxed stepping: strides past the safe distance, backing off when that overshoots. */
const RELAX = 1.5

/** Where a ray enters and leaves the box, narrowed one axis at a time by `clip`. */
const span = { near: 0, far: Infinity }

/** Narrows `span` to where `o + t·d` lies in `[lo, hi]` along one axis; false once it's empty. */
function clip(o: number, d: number, lo: number, hi: number) {
	if (d > -1e-12 && d < 1e-12) return o >= lo && o <= hi
	let t0 = (lo - o) / d,
		t1 = (hi - o) / d
	if (t0 > t1) {
		const swap = t0
		t0 = t1
		t1 = swap
	}
	if (t0 > span.near) span.near = t0
	if (t1 < span.far) span.far = t1
	return span.near <= span.far
}

/**
 * Clips the ray `o + t·d` to the box, grown by `margin` on every side, into `span`. False if it
 * misses.
 */
function enter(
	ox: number,
	oy: number,
	oz: number,
	dx: number,
	dy: number,
	dz: number,
	margin: number,
) {
	const { min, max } = GLOVE_BOX
	span.near = 0
	span.far = Infinity
	return (
		clip(ox, dx, min[0] - margin, max[0] + margin) &&
		clip(oy, dy, min[1] - margin, max[1] + margin) &&
		clip(oz, dz, min[2] - margin, max[2] + margin)
	)
}

/** `fieldDistance`, kept a lower bound past the edges of the grid too. */
function boundedDistance(x: number, y: number, z: number) {
	const { x0, y0, z0, nx, ny, nz, scale } = GRID
	const x1 = x0 + (nx - 1) / scale,
		y1 = y0 + (ny - 1) / scale,
		z1 = z0 + (nz - 1) / scale
	const cx = x < x0 ? x0 : x > x1 ? x1 : x,
		cy = y < y0 ? y0 : y > y1 ? y1 : y,
		cz = z < z0 ? z0 : z > z1 ? z1 : z
	return (
		fieldDistance(cx, cy, cz) -
		Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy) + (z - cz) * (z - cz))
	)
}

/** How close a cone gets before handing over to the rays inside it. */
const CONE_EPSILON = 0.01

/**
 * Sphere-traces a cylinder of radius `r` around the ray `o + t·d` (Amanatides' cone tracing, with
 * parallel rays): how far along it all of it stays clear of the glove, so any ray inside it can
 * start there. Infinity if it misses the glove altogether.
 */
export function clearance(
	ox: number,
	oy: number,
	oz: number,
	dx: number,
	dy: number,
	dz: number,
	r: number,
) {
	if (!ready || !enter(ox, oy, oz, dx, dy, dz, r)) return Infinity
	let t = span.near
	const end = span.far
	for (let i = 0; i < MAX_STEPS && t < end; i++) {
		// A ball this big around the axis holds the cylinder this far along
		const step = boundedDistance(ox + t * dx, oy + t * dy, oz + t * dz) * SAFE - r
		if (step < CONE_EPSILON) return t
		t += step
	}
	return t < end ? t : Infinity
}

/** Like `intersectGlove`, but knowing the ray is clear of the glove before `from`. */
function trace(
	ox: number,
	oy: number,
	oz: number,
	dx: number,
	dy: number,
	dz: number,
	hit: Hit,
	from: number,
) {
	// March only through the box: most rays that miss the glove never take a step
	if (!enter(ox, oy, oz, dx, dy, dz, 0)) return false
	let t = Math.max(span.near, from)
	const end = span.far

	// Sphere tracing, over-relaxed (Keinert et al., "Enhanced Sphere Tracing")
	let relax = RELAX,
		stride = 0,
		previous = 0
	for (let i = 0; i < MAX_STEPS && t < end; i++) {
		const x = ox + t * dx,
			y = oy + t * dy,
			z = oz + t * dz
		const d = fieldDistance(x, y, z)
		const radius = d * SAFE
		// The last stride overshot if this step's empty ball doesn't reach back to the last one's
		if (relax > 1 && radius + previous < stride) {
			// Go back and take the safe step from there instead
			t += previous - stride
			stride = previous
			relax = 1
			continue
		}
		if (d < EPSILON) {
			fieldDistance(x, y, z, true)
			return land(x, y, z, dx, dy, dz, hit)
		}
		stride = radius * relax
		previous = radius
		t += stride
	}
	return false
}

/** Fills `hit` at `(x, y, z)` on the surface, where `gradient` was just found. */
function land(x: number, y: number, z: number, dx: number, dy: number, dz: number, hit: Hit) {
	// The normal is the field's gradient, from the same samples as the distance
	let [nx, ny, nz] = gradient
	// Grazing an edge thinner than the grid, it can lean away from the ray, but a ray only sees
	// surfaces that face it: take it as the edge of the silhouette
	const along = nx * dx + ny * dy + nz * dz
	if (along > 0) {
		nx -= along * dx
		ny -= along * dy
		nz -= along * dz
	}
	const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
	hit.nx = len > 1e-9 ? nx / len : -dx
	hit.ny = len > 1e-9 ? ny / len : -dy
	hit.nz = len > 1e-9 ? nz / len : -dz
	hit.material = surfaceAt(x, y, z)
	return true
}

export const intersectGlove: Intersect = (ox, oy, oz, dx, dy, dz, hit) =>
	ready && trace(ox, oy, oz, dx, dy, dz, hit, 0)

/**
 * Cones traced for one view: how far each stays clear, by patch of the screen. Each view takes
 * the next of a few, so the views of one frame (one per step of motion blur) don't share one.
 */
const CONES = Array.from({ length: 2 * MAX_BLUR_STEPS }, () => ({
	/** Bumped for each view; a patch stamped with it has been cast in this one. */
	view: 0,
	stamps: new Int32Array(0),
	clear: new Float64Array(0),
}))
let nextCones = 0

/**
 * Casts rays at the glove turned by `m`, a patch `patch` across at a time: one cone around each
 * patch first, which most rays that miss never get past, and which carries the rest most of
 * the way in.
 */
export function viewGlove(m: Mat3, patch: number): Cast {
	// As in `castLocal`: world → local is mᵀ
	const dx = -m[6],
		dy = -m[7],
		dz = -m[8]
	const zx = RAY_START * m[6],
		zy = RAY_START * m[7],
		zz = RAY_START * m[8]
	// Patches tile the unit square with a patch to spare around it
	const n = Math.ceil(2 / patch) + 3
	const cones = CONES[nextCones++ % CONES.length]
	if (cones.stamps.length < n * n) {
		cones.stamps = new Int32Array(n * n)
		cones.clear = new Float64Array(n * n)
	}
	const view = ++cones.view
	const { stamps, clear } = cones
	const radius = patch * Math.SQRT1_2

	return (x, y, hit) => {
		const i = Math.floor((x + 1) / patch) + 1,
			j = Math.floor((y + 1) / patch) + 1
		let from = 0
		if (i >= 0 && i < n && j >= 0 && j < n) {
			const k = j * n + i
			if (stamps[k] !== view) {
				const cx = (i - 0.5) * patch - 1,
					cy = (j - 0.5) * patch - 1
				clear[k] = clearance(
					cx * m[0] + cy * m[3] + zx,
					cx * m[1] + cy * m[4] + zy,
					cx * m[2] + cy * m[5] + zz,
					dx,
					dy,
					dz,
					radius,
				)
				stamps[k] = view
			}
			from = clear[k]
			if (from === Infinity) return false
		}
		if (
			!trace(
				x * m[0] + y * m[3] + zx,
				x * m[1] + y * m[4] + zy,
				x * m[2] + y * m[5] + zz,
				dx,
				dy,
				dz,
				hit,
				from,
			)
		)
			return false
		const { nx, ny, nz } = hit
		hit.nx = m[0] * nx + m[1] * ny + m[2] * nz
		hit.ny = m[3] * nx + m[4] * ny + m[5] * nz
		hit.nz = m[6] * nx + m[7] * ny + m[8] * nz
		return true
	}
}

// --- Shape ---

/** Turning about the vertical, tipped back a little. */
const SPIN_AXIS: Vec3 = normalize([0.05, 1, 0.1])
/**
 * Starts turned this far toward its thumb side, with the pocket in view. The spin brings it
 * around face-on, then shows the pinky side, the back of the finger stalls and the web.
 */
const HEADING = 0.3

export const GLOVE: Shape = {
	name: 'baseball glove',
	materials: MATERIALS,
	credit: GLOVE_CREDIT,
	// Sphere tracing costs more per sample than the others, so blur a fast spin over fewer steps
	blurSteps: 3,

	start(random = Math.random) {
		const tilt = quatFromRotation([-0.22, 0, 0])
		const heading = quatFromRotation(scale(SPIN_AXIS, HEADING + (random() - 0.5) * 0.4))
		return { orientation: quatMul(heading, tilt), spin: scale(SPIN_AXIS, -IDLE_SPIN) }
	},

	prepare() {
		return prepareGlove()
	},

	view(m: Mat3, cell: number) {
		return viewGlove(m, cell)
	},
}
