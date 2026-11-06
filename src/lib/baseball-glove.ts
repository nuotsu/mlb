/**
 * The homepage's ASCII baseball glove (`#ui/ascii-object.svelte`): a stylized fielder's glove for
 * a left hand, built as a signed distance field and sphere-traced. A padded palm with a pocket
 * pressed into it, a heel roll, four fingers and a thumb curling forward around the pocket, a
 * laced web between the thumb and the index finger, and an opening for the hand on the back.
 *
 * Seen from the pocket side: +y runs up the fingers, +x toward the thumb, +z out of the pocket.
 * The parts are laid out in "design" units, then centered and scaled to just fit the unit sphere.
 */

import {
	castLocal,
	IDLE_SPIN,
	normalize,
	quatFromRotation,
	quatMul,
	scale,
	type Intersect,
	type Mat3,
	type Material,
	type Shape,
	type Vec3,
} from './ascii-3d.js'

export const LEATHER = 0
export const POCKET = 1
export const LACE = 2
export const LINING = 3

const MATERIALS: Material[] = [
	// Oiled leather
	{ albedo: 0.74, sheen: 0.3 },
	// The pocket, darkened by years of catches
	{ albedo: 0.52, sheen: 0.12 },
	// Rawhide laces: drawn red where they cover enough of a cell
	{ albedo: 0.42, sheen: 0.1, sewnInto: LEATHER },
	// Inside the hand opening
	{ albedo: 0.12, sheen: 0 },
]

// --- Parts, in design units ---

/** Axis-aligned box, for cheap lower bounds on the distance to what's inside it. */
interface Box {
	x0: number
	y0: number
	z0: number
	x1: number
	y1: number
	z1: number
}

/** A capsule whose radius tapers from `r0` at `a` to `r0 + dr` at `b`, precomputed for speed. */
interface Capsule extends Box {
	ax: number
	ay: number
	az: number
	/** `b − a`, and `1 / |b − a|²`. */
	ux: number
	uy: number
	uz: number
	inv: number
	r0: number
	dr: number
}

function capsule(a: Vec3, b: Vec3, r0: number, r1: number): Capsule {
	const [ux, uy, uz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
	const r = Math.max(r0, r1)
	return {
		ax: a[0],
		ay: a[1],
		az: a[2],
		ux,
		uy,
		uz,
		inv: 1 / (ux * ux + uy * uy + uz * uz),
		r0,
		dr: r1 - r0,
		x0: Math.min(a[0], b[0]) - r,
		y0: Math.min(a[1], b[1]) - r,
		z0: Math.min(a[2], b[2]) - r,
		x1: Math.max(a[0], b[0]) + r,
		y1: Math.max(a[1], b[1]) + r,
		z1: Math.max(a[2], b[2]) + r,
	}
}

/** Pinky to index finger. */
const FINGERS = [
	capsule([-0.33, -0.12, -0.01], [-0.45, 0.55, 0.03], 0.105, 0.098),
	capsule([-0.13, -0.06, 0], [-0.17, 0.74, 0.04], 0.11, 0.103),
	capsule([0.07, -0.04, 0], [0.08, 0.8, 0.04], 0.112, 0.105),
	capsule([0.26, -0.08, 0], [0.33, 0.71, 0.04], 0.11, 0.102),
]
const THUMB = capsule([0.36, -0.5, 0.02], [0.68, 0.2, 0.05], 0.125, 0.1)
const HEEL = capsule([-0.34, -0.58, 0.02], [0.3, -0.64, 0.04], 0.16, 0.15)

/** An axis-aligned ellipsoid, with reciprocals of its radii. */
function ellipsoid(center: Vec3, radii: Vec3) {
	const [ix, iy, iz] = radii.map((r) => 1 / r)
	return {
		x: center[0],
		y: center[1],
		z: center[2],
		ix,
		iy,
		iz,
		min: Math.min(...radii),
		x0: center[0] - radii[0],
		y0: center[1] - radii[1],
		z0: center[2] - radii[2],
		x1: center[0] + radii[0],
		y1: center[1] + radii[1],
		z1: center[2] + radii[2],
	}
}
type Ellipsoid = ReturnType<typeof ellipsoid>

/** The palm, with the pocket (a ball) pressed into its face and the hand opening in its back. */
const PALM = ellipsoid([-0.02, -0.22, -0.04], [0.46, 0.47, 0.25])
const POCKET_BALL = { x: 0.06, y: -0.14, z: 0.62, r: 0.5 }
const POCKET_BLEND = 0.08
const OPENING = ellipsoid([-0.02, -0.52, -0.27], [0.25, 0.13, 0.1])
const OPENING_BLEND = 0.03

/** The web: a padded panel across the gap between the thumb and the index finger. */
const WEB = (() => {
	const angle = -0.42
	const [x, y, z, hx, hy, hz, round] = [0.51, 0.34, 0.05, 0.11, 0.25, 0.035, 0.03]
	const cos = Math.cos(angle),
		sin = Math.sin(angle)
	const ex = Math.abs(cos) * hx + Math.abs(sin) * hy + round
	const ey = Math.abs(sin) * hx + Math.abs(cos) * hy + round
	// Its bounding box, for culling
	const [x0, y0, z0, x1, y1, z1] = [x - ex, y - ey, z - hz - round, x + ex, y + ey, z + hz + round]
	return { x, y, z, cos, sin, hx, hy, hz, round, x0, y0, z0, x1, y1, z1 }
})()
const WEB_LACES = 4

/** Fingers and thumb curl toward the pocket: z shifts forward past these lines, quadratically. */
const CURL_Y = 0.15
const CURL_Y_RATE = 0.55
const CURL_X = 0.35
const CURL_X_RATE = 0.7

/** Smooth-union blend radii: fingers keep a groove between them, the rest flows together. */
const BLEND = 0.05
const FINGER_BLEND = 0.018
const WEB_BLEND = 0.03

/** Design units → object radii: the glove's enclosing sphere (`baseball-glove.test.ts` checks it). */
const CENTER: Vec3 = [0.028, 0.034, 0.179]
const SIZE = 0.92

// --- Distance ---

/** How far `(x, y, z)` is outside `b` along its farthest axis: never more than the true distance. */
function gap(b: Box, x: number, y: number, z: number) {
	let g = b.x0 - x
	if (x - b.x1 > g) g = x - b.x1
	if (b.y0 - y > g) g = b.y0 - y
	if (y - b.y1 > g) g = y - b.y1
	if (b.z0 - z > g) g = b.z0 - z
	if (z - b.z1 > g) g = z - b.z1
	return g
}

function capsuleDistance(c: Capsule, x: number, y: number, z: number) {
	const px = x - c.ax,
		py = y - c.ay,
		pz = z - c.az
	let h = (px * c.ux + py * c.uy + pz * c.uz) * c.inv
	h = h < 0 ? 0 : h > 1 ? 1 : h
	const dx = px - c.ux * h,
		dy = py - c.uy * h,
		dz = pz - c.uz * h
	return Math.sqrt(dx * dx + dy * dy + dz * dz) - (c.r0 + c.dr * h)
}

/** Approximate distance to an ellipsoid (well behaved near its surface). */
function ellipsoidDistance(e: Ellipsoid, x: number, y: number, z: number) {
	const px = (x - e.x) * e.ix,
		py = (y - e.y) * e.iy,
		pz = (z - e.z) * e.iz
	const k0 = Math.sqrt(px * px + py * py + pz * pz)
	const qx = px * e.ix,
		qy = py * e.iy,
		qz = pz * e.iz
	const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz)
	return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -e.min
}

/** Polynomial smooth minimum. */
function smin(a: number, b: number, k: number) {
	const h = k - Math.abs(a - b)
	return h > 0 ? Math.min(a, b) - (h * h) / (4 * k) : Math.min(a, b)
}

/** Polynomial smooth maximum. */
function smax(a: number, b: number, k: number) {
	const h = k - Math.abs(a - b)
	return h > 0 ? Math.max(a, b) + (h * h) / (4 * k) : Math.max(a, b)
}

function pocketDistance(x: number, y: number, z: number) {
	const dx = x - POCKET_BALL.x,
		dy = y - POCKET_BALL.y,
		dz = z - POCKET_BALL.z
	return Math.sqrt(dx * dx + dy * dy + dz * dz) - POCKET_BALL.r
}

/** Nearest the pocket ball can reach toward −z, blend included. */
const POCKET_REACH = POCKET_BALL.z - POCKET_BALL.r - POCKET_BLEND

function palmDistance(x: number, y: number, z: number) {
	let d = ellipsoidDistance(PALM, x, y, z)
	// A cut only changes the distance where it comes within its blend of it, so skip it elsewhere
	if (z > POCKET_REACH + d) d = smax(d, -pocketDistance(x, y, z), POCKET_BLEND)
	if (gap(OPENING, x, y, z) < OPENING_BLEND - d)
		d = smax(d, -ellipsoidDistance(OPENING, x, y, z), OPENING_BLEND)
	return d
}

function webDistance(x: number, y: number, z: number) {
	const px = x - WEB.x,
		py = y - WEB.y
	const qx = Math.abs(WEB.cos * px + WEB.sin * py) - WEB.hx,
		qy = Math.abs(-WEB.sin * px + WEB.cos * py) - WEB.hy,
		qz = Math.abs(z - WEB.z) - WEB.hz
	const ox = qx > 0 ? qx : 0,
		oy = qy > 0 ? qy : 0,
		oz = qz > 0 ? qz : 0
	return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - WEB.round
}

/** Curls the fingers and thumb forward by shifting space back past the curl lines. */
function uncurl(x: number, y: number, z: number) {
	const up = y > CURL_Y ? y - CURL_Y : 0
	const out = x > CURL_X ? x - CURL_X : 0
	return z - CURL_Y_RATE * up * up - CURL_X_RATE * out * out
}

/** Signed distance to the glove in design units, at design point `(x, y, z)` (already uncurled). */
function designDistance(x: number, y: number, z: number) {
	let d = smin(palmDistance(x, y, z), capsuleDistance(HEEL, x, y, z), BLEND)
	// Parts whose boxes are farther than the blend can't change what's already near, so skip them
	if (gap(THUMB, x, y, z) < d + BLEND) d = smin(d, capsuleDistance(THUMB, x, y, z), BLEND)
	let fingers = Infinity
	for (let i = 0; i < FINGERS.length; i++) {
		const f = FINGERS[i]
		if (gap(f, x, y, z) < Math.min(d, fingers) + BLEND)
			fingers = smin(fingers, capsuleDistance(f, x, y, z), FINGER_BLEND)
	}
	d = smin(d, fingers, BLEND)
	if (gap(WEB, x, y, z) < d + WEB_BLEND) d = smin(d, webDistance(x, y, z), WEB_BLEND)
	return d
}

/** Signed distance from `(x, y, z)`, in object radii, to the glove. */
export function gloveDistance(x: number, y: number, z: number) {
	const dx = x * SIZE + CENTER[0],
		dy = y * SIZE + CENTER[1]
	return designDistance(dx, dy, uncurl(dx, dy, z * SIZE + CENTER[2])) / SIZE
}

// --- Materials ---

const fract = (v: number) => v - Math.floor(v)

/** Where a capsule's axis is nearest `(x, y, z)`, from 0 at a to 1 at b (unclamped). */
function along(c: Capsule, x: number, y: number, z: number) {
	return ((x - c.ax) * c.ux + (y - c.ay) * c.uy + (z - c.az) * c.uz) * c.inv
}

/** A lace loops over each fingertip, front to back. */
function fingertip(c: Capsule, x: number, y: number, z: number) {
	if (along(c, x, y, z) < 0.93) return LEATHER
	// Distance across the finger, in the glove's plane
	const across = ((x - c.ax - c.ux) * c.uy - (y - c.ay - c.uy) * c.ux) / Math.hypot(c.ux, c.uy)
	return Math.abs(across) < 0.026 ? LACE : LEATHER
}

/** What the glove's surface is made of at `(x, y, z)` (object radii), a point on it. */
export function gloveMaterial(x0: number, y0: number, z0: number) {
	const x = x0 * SIZE + CENTER[0],
		y = y0 * SIZE + CENTER[1]
	const z = uncurl(x, y, z0 * SIZE + CENTER[2])

	// Whichever part is nearest owns the point
	const palm = palmDistance(x, y, z)
	const heel = capsuleDistance(HEEL, x, y, z)
	const thumb = capsuleDistance(THUMB, x, y, z)
	const web = webDistance(x, y, z)
	let finger = Infinity,
		which = 0
	for (let i = 0; i < FINGERS.length; i++) {
		const d = capsuleDistance(FINGERS[i], x, y, z)
		if (d < finger) {
			finger = d
			which = i
		}
	}
	const nearest = Math.min(palm, heel, thumb, web, finger)

	if (nearest === palm) {
		if (ellipsoidDistance(OPENING, x, y, z) < 0.03) return LINING
		// The pressed-in part of the palm is the pocket
		return pocketDistance(x, y, z) < 0.04 ? POCKET : LEATHER
	}
	if (nearest === web) {
		// Laces run across the web like the rungs of a ladder
		const v = -WEB.sin * (x - WEB.x) + WEB.cos * (y - WEB.y)
		return fract(((v / WEB.hy + 1) / 2) * WEB_LACES + 0.5) < 0.34 ? LACE : LEATHER
	}
	if (nearest === heel) {
		// Laces bind the bottom edge of the heel roll, wound around it
		const u = along(HEEL, x, y, z)
		const cy = HEEL.ay + HEEL.uy * u,
			cz = HEEL.az + HEEL.uz * u
		if (y - cy > -0.085) return LEATHER
		return fract(u * 9 + Math.atan2(z - cz, y - cy) / Math.PI) < 0.3 ? LACE : LEATHER
	}
	return fingertip(nearest === thumb ? THUMB : FINGERS[which], x, y, z)
}

// --- Intersection ---

/** The glove's bounding box in design units, a little padded (the test checks it holds it). */
const BOX_MIN: Vec3 = [-0.555, -0.795, -0.305]
const BOX_MAX: Vec3 = [0.78, 0.92, 0.4]
/** …and in object radii. */
export const GLOVE_BOX = {
	min: BOX_MIN.map((v, i) => (v - CENTER[i]) / SIZE) as Vec3,
	max: BOX_MAX.map((v, i) => (v - CENTER[i]) / SIZE) as Vec3,
}

/*
 * Evaluating every part costs too much to do several times per sample per frame, and the glove
 * never changes, so its distance field is sampled once into a grid over its box and traced with
 * trilinear lookups. Materials, which need detail finer than the grid, come from the exact parts.
 */
const VOXEL = 0.025

/**
 * The grid, padded a voxel past the box on every side so lookups near its faces stay inside.
 * Held in one object: hot loops read an object's fields faster than module-level bindings.
 */
const GRID = (() => {
	const [x0, y0, z0] = GLOVE_BOX.min.map((v) => v - VOXEL)
	const [nx, ny, nz] = GLOVE_BOX.min.map((v, i) => Math.ceil((GLOVE_BOX.max[i] - v) / VOXEL) + 3)
	// Allocated on first use, so loading the module costs nothing unless the glove is shown
	return { x0, y0, z0, nx, ny, nz, scale: 1 / VOXEL, values: new Float32Array(0) }
})()
/** Slices of constant z filled so far. */
let filled = 0

/**
 * Fills the distance grid, a slice at a time until `deadline` (a `performance.now()` time), so
 * the one-time cost (about 130k samples) can be spread over a few frames. True once it's full.
 */
export function prepareGlove(deadline = Infinity) {
	if (!GRID.values.length) GRID.values = new Float32Array(GRID.nx * GRID.ny * GRID.nz)
	const { x0, y0, z0, nx, ny, nz, values } = GRID
	for (; filled < nz && performance.now() < deadline; filled++) {
		const k = filled
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++)
				values[(k * ny + j) * nx + i] = gloveDistance(
					x0 + i * VOXEL,
					y0 + j * VOXEL,
					z0 + k * VOXEL,
				)
	}
	return filled === nz
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

const MAX_STEPS = 64
/** Close enough to call a hit: a fraction of the spacing between sub-samples. */
const EPSILON = 0.005
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

export const intersectGlove: Intersect = (ox, oy, oz, dx, dy, dz, hit) => {
	// March only through the bounding box: most rays that miss the glove never take a step
	const { min, max } = GLOVE_BOX
	span.near = 0
	span.far = Infinity
	if (
		!clip(ox, dx, min[0], max[0]) ||
		!clip(oy, dy, min[1], max[1]) ||
		!clip(oz, dz, min[2], max[2])
	)
		return false
	let t = span.near
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
			// The normal is the field's gradient, from the same samples as the distance
			fieldDistance(x, y, z, true)
			const [nx, ny, nz] = gradient
			const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
			hit.nx = nx / len
			hit.ny = ny / len
			hit.nz = nz / len
			hit.material = gloveMaterial(x, y, z)
			return true
		}
		stride = radius * relax
		previous = radius
		t += stride
	}
	return false
}

// --- Shape ---

/** Pocket toward the viewer, tipped back a little, turning about the vertical. */
const SPIN_AXIS: Vec3 = normalize([0.05, 1, 0.1])

export const GLOVE: Shape = {
	name: 'baseball glove',
	materials: MATERIALS,
	// Sphere tracing costs more per sample than the others, so blur a fast spin over fewer steps
	blurSteps: 3,

	start(random = Math.random) {
		const tilt = quatMul(quatFromRotation([-0.22, 0, 0]), quatFromRotation([0, 0, 0.1]))
		const heading = quatFromRotation(scale(SPIN_AXIS, (random() - 0.5) * 1.4))
		return {
			orientation: quatMul(heading, tilt),
			spin: scale(SPIN_AXIS, IDLE_SPIN),
		}
	},

	prepare(deadline) {
		return prepareGlove(deadline)
	},

	view(m: Mat3) {
		// Without a `prepare` first, finish the grid now
		prepareGlove()
		return castLocal(m, intersectGlove)
	},
}
