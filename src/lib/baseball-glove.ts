/**
 * The homepage's ASCII baseball glove (`#ui/ascii-object.svelte`): an 11¼" second baseman's glove
 * for a left hand, as a signed distance field that's sampled into a grid and sphere-traced.
 *
 * It's laid out flat first, in inches, seen from the pocket side: `u` runs across toward the
 * thumb, `v` up the fingers, and `w` out of the pocket. Four finger stalls side by side, a padded
 * palm, a heel roll, the thumb, an I-web between the thumb and the index finger, and an open back
 * with a hole for the hand. Then it's shaped like a broken-in glove: wrapped around a vertical
 * cylinder in front of it, so the thumb and pinky sides fold toward each other, with the fingers
 * curling forward over the pocket. That fold is what makes it read as a glove.
 *
 * In object space +y runs up the fingers, +x toward the thumb, and +z out of the pocket.
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
export const WEB_GAP = 4
export const SEAM = 5

const MATERIALS: Material[] = [
	// Oiled leather, light enough that its lit side reads pale beside the seams
	{ albedo: 0.86, sheen: 0.25 },
	// The pocket, darkened by years of catches
	{ albedo: 0.5, sheen: 0.12 },
	// Rawhide laces: drawn red where they cover enough of a cell
	{ albedo: 0.42, sheen: 0.1, sewnInto: LEATHER },
	// Inside the hand opening
	{ albedo: 0.1, sheen: 0 },
	// The open gaps between the web's laces
	{ albedo: 0.2, sheen: 0.02 },
	// Welted seams down the creases between the stalls
	{ albedo: 0.18, sheen: 0.02 },
]

// --- Parts, laid out flat in inches ---

/**
 * A finger stall or thumb: a capsule along `a → b` in the `uv` plane, flattened through the
 * glove. Its half-width tapers from `r0` to `r1`, and its half-depth is `depth` times that.
 */
interface Stall {
	au: number
	av: number
	/** `b − a`, and `1 / |b − a|²`. */
	du: number
	dv: number
	inv: number
	r0: number
	r1: number
	depth: number
	/** Where its middle sits through the glove. */
	w: number
	/** The top of its tip, for laces. */
	top: number
}

function stall(a: [number, number], b: [number, number], r0: number, r1: number, w = -0.1): Stall {
	const [du, dv] = [b[0] - a[0], b[1] - a[1]]
	return {
		au: a[0],
		av: a[1],
		du,
		dv,
		inv: 1 / (du * du + dv * dv),
		r0,
		r1,
		depth: 0.72,
		w,
		top: b[1] + r1,
	}
}

/** A stall from `base`, leaning `angle` radians toward the thumb, `length` to its tip's center. */
function lean(
	base: [number, number],
	angle: number,
	length: number,
	r0: number,
	r1: number,
	w?: number,
) {
	const tip: [number, number] = [
		base[0] + length * Math.sin(angle),
		base[1] + length * Math.cos(angle),
	]
	return stall(base, tip, r0, r1, w)
}

/**
 * Pinky to index finger: fat, padded stalls pressed side by side, nearly parallel, the middle one
 * longest. The pinky's runs down the outer edge toward the heel.
 */
const FINGERS = [
	lean([-2.0, -1.4], -0.07, 5.1, 0.84, 0.76),
	lean([-0.66, 0.4], -0.025, 4.9, 0.8, 0.76),
	lean([0.66, 0.4], 0.02, 5.2, 0.8, 0.76),
	lean([1.97, 0.3], 0.07, 4.6, 0.78, 0.73),
]
/** The thumb stall angles well out from the heel, ending about halfway up the index finger. */
const THUMB = lean([2.6, -3.4], 0.56, 6.1, 0.86, 0.66, -0.05)

/** The heel roll across the bottom. */
const HEEL = { u0: -1.55, u1: 2.25, v: -4.55, r: 0.75, w: -0.1 }

/** The padded palm: a rounded rectangle, `half` thick, under the fingers and over the heel. */
const PALM = { u0: -2.75, u1: 3.0, v0: -4.7, v1: 1.2, corner: 1.7, half: 0.32, w: 0 }

/**
 * The I-web: a panel filling the gap between the index finger and the thumb, as a convex outline
 * (counterclockwise), with a post up its middle and laces across to either side.
 */
const WEB_OUTLINE: [number, number][] = [
	[2.3, 0.0],
	[3.7, -0.9],
	[5.75, 2.2],
	[5.4, 3.05],
	[3.0, 4.85],
]
const WEB = { half: 0.17, w: 0.12, post: [3.75, 0.0, 4.1, 3.9] as const, rung: 0.8, bar: 0.5 }

/** The slot the hand goes in, across the back above the heel. */
const OPENING = { u: 0.3, v: -3.45, w: -0.62, ru: 2.3, rv: 0.55, rw: 0.5 }

/** How far either side of a crease its seam shows. */
const SEAM_WIDTH = 0.16

/** Where the pocket's darkened leather is, on the palm's face. */
const POCKET_AREA = { u: 0.7, v: -1.5, ru: 2.1, rv: 2.3 }

/** Smooth-union blend radii: the finger stalls keep a crease between them, the rest flows. */
const BLEND = 0.35
const FINGER_BLEND = 0.1
const OPENING_BLEND = 0.15

// --- Shaping ---

/** The fold: the flat glove wraps around a vertical axis at `u = FOLD_U`, this far in front. */
const FOLD_U = 1.6
const FOLD_RADIUS = 3.8
/** The fingers curl forward above this line, around a circle of this radius… */
const CURL_V = 0.8
const CURL_RADIUS = 6.2
/** …and the heel below this one, so the palm between them is a bowl. */
const HEEL_V = -1.6
const HEEL_RADIUS = 5.2

/** Inches → object radii: the shaped glove's enclosing sphere (the test checks it). */
const CENTER: Vec3 = [0.85, 0.2, 1.58]
const SIZE = 5.9

/** A point of the shaped glove, in inches, in object radii. */
export function toObject([x, y, z]: Vec3): Vec3 {
	return [(x - CENTER[0]) / SIZE, (y - CENTER[1]) / SIZE, (z - CENTER[2]) / SIZE]
}

// --- Distance ---

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

/** Where along a stall's axis `(u, v)` is nearest, from 0 at its base to 1 at its tip. */
function along(s: Stall, u: number, v: number) {
	const h = ((u - s.au) * s.du + (v - s.av) * s.dv) * s.inv
	return h < 0 ? 0 : h > 1 ? 1 : h
}

/**
 * Distance to a stall. Its cross-section is an ellipse, so this stretches depth into a circle and
 * scales the result back down: never more than the true distance.
 */
function stallDistance(s: Stall, u: number, v: number, w: number) {
	const h = along(s, u, v)
	const du = u - s.au - s.du * h,
		dv = v - s.av - s.dv * h,
		dw = (w - s.w) / s.depth
	return (Math.sqrt(du * du + dv * dv + dw * dw) - (s.r0 + (s.r1 - s.r0) * h)) * s.depth
}

/**
 * A flat 2D shape (signed distance `d2` from its outline, negative inside) given thickness: a
 * slab `half` thick with fully rounded edges, centered on `w = center`.
 */
function slab(d2: number, w: number, half: number, center: number) {
	const a = d2 + half,
		b = Math.abs(w - center)
	const ox = a > 0 ? a : 0,
		oy = b > 0 ? b : 0
	return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(a, b), 0) - half
}

function palmDistance(u: number, v: number, w: number) {
	// Rounded rectangle
	const cu = (PALM.u0 + PALM.u1) / 2,
		cv = (PALM.v0 + PALM.v1) / 2
	const qu = Math.abs(u - cu) - (PALM.u1 - PALM.u0) / 2 + PALM.corner,
		qv = Math.abs(v - cv) - (PALM.v1 - PALM.v0) / 2 + PALM.corner
	const ou = qu > 0 ? qu : 0,
		ov = qv > 0 ? qv : 0
	const d2 = Math.sqrt(ou * ou + ov * ov) + Math.min(Math.max(qu, qv), 0) - PALM.corner
	return slab(d2, w, PALM.half, PALM.w)
}

function heelDistance(u: number, v: number, w: number) {
	const cu = u < HEEL.u0 ? HEEL.u0 : u > HEEL.u1 ? HEEL.u1 : u
	const du = u - cu,
		dv = v - HEEL.v,
		dw = w - HEEL.w
	return Math.sqrt(du * du + dv * dv + dw * dw) - HEEL.r
}

/** The web outline's edges as `[nu, nv, d]`: outward unit normal and offset, `n·p ≤ d` inside. */
const WEB_EDGES = WEB_OUTLINE.map(([u0, v0], i) => {
	const [u1, v1] = WEB_OUTLINE[(i + 1) % WEB_OUTLINE.length]
	const len = Math.hypot(u1 - u0, v1 - v0)
	// Counterclockwise, so outward is the edge turned clockwise
	const nu = (v1 - v0) / len,
		nv = -(u1 - u0) / len
	return [nu, nv, nu * u0 + nv * v0] as const
})

/** Signed distance from `(u, v)` to the web's outline, negative inside (exact inside, a bound outside). */
function webOutline(u: number, v: number) {
	let d = -Infinity
	for (const [nu, nv, offset] of WEB_EDGES) {
		const e = nu * u + nv * v - offset
		if (e > d) d = e
	}
	return d
}

function webDistance(u: number, v: number, w: number) {
	return slab(webOutline(u, v), w, WEB.half, WEB.w)
}

/** Smallest of the opening's radii. */
const OPENING_MIN = Math.min(OPENING.ru, OPENING.rv, OPENING.rw)

function openingDistance(u: number, v: number, w: number) {
	// Approximate ellipsoid distance, good near its surface
	const pu = (u - OPENING.u) / OPENING.ru,
		pv = (v - OPENING.v) / OPENING.rv,
		pw = (w - OPENING.w) / OPENING.rw
	const k0 = Math.sqrt(pu * pu + pv * pv + pw * pw)
	const k1 = Math.sqrt((pu / OPENING.ru) ** 2 + (pv / OPENING.rv) ** 2 + (pw / OPENING.rw) ** 2)
	const d = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -OPENING_MIN
	// Deep inside, that can claim far more room than there is (the opening is the empty slot, so
	// that's room rays step through). A ball of `(1 − k0) × smallest radius` always fits
	return k0 < 1 ? Math.max(d, (k0 - 1) * OPENING_MIN) : d
}

/** Signed distance to the flat glove, in inches. */
export function flatDistance(u: number, v: number, w: number) {
	let d = smin(palmDistance(u, v, w), heelDistance(u, v, w), BLEND)
	d = smin(d, stallDistance(THUMB, u, v, w), BLEND)
	let fingers = stallDistance(FINGERS[0], u, v, w)
	for (let i = 1; i < FINGERS.length; i++)
		fingers = smin(fingers, stallDistance(FINGERS[i], u, v, w), FINGER_BLEND)
	d = smin(d, fingers, BLEND)
	d = smin(d, webDistance(u, v, w), BLEND / 2)
	return smax(d, -openingDistance(u, v, w), OPENING_BLEND)
}

/** A point of the shaped glove, in inches, taken back to where it lies on the flat one. */
interface Flat {
	u: number
	v: number
	w: number
	/** Distance from the fold's axis. */
	fold: number
	/** `stretchAt(fold)`. */
	stretch: number
}

const flat: Flat = { u: 0, v: 0, w: 0, fold: 0, stretch: 1 }

/**
 * Bends of the flat glove's `vw` plane past the line `v = at`, toward `dir` (+1 up, −1 down),
 * curving forward around a circle of `radius` in front of it.
 */
const BENDS = [
	{ at: CURL_V, radius: CURL_RADIUS, dir: 1 },
	{ at: HEEL_V, radius: HEEL_RADIUS, dir: -1 },
] as const

const TIGHTEST_BEND = Math.min(...BENDS.map((b) => b.radius))

/**
 * The stretch correction `fold` from the fold's axis. Unfolding stretches space across by
 * `FOLD_RADIUS / fold` inside the fold, and in front of a bend by `radius / (radius − w)` at
 * most (most for the tightest bend), so this is the reciprocal of both. It depends on nothing but
 * `fold`, and only grows with it.
 */
function stretchAt(fold: number) {
	if (fold >= FOLD_RADIUS) return 1
	const w = FOLD_RADIUS - fold
	return (fold / FOLD_RADIUS) * ((TIGHTEST_BEND - w) / TIGHTEST_BEND)
}

/** Undoes the shaping at `(x, y, z)` (inches, shaped), into `out`. */
export function unfold(x: number, y: number, z: number, out: Flat = flat) {
	// The fold around a vertical cylinder: arc length around it is distance across
	const fx = x - FOLD_U,
		fz = FOLD_RADIUS - z
	const fold = Math.sqrt(fx * fx + fz * fz)
	const wc = FOLD_RADIUS - fold
	out.u = FOLD_U + FOLD_RADIUS * Math.atan2(fx, fz)
	out.v = y
	out.w = wc
	out.fold = fold
	out.stretch = stretchAt(fold)

	// The fingers' curl and the heel's, around horizontal axes
	for (const { at, radius, dir } of BENDS) {
		const cv = (y - at) * dir,
			cw = radius - wc
		const angle = Math.atan2(cv, cw)
		if (angle <= 0) continue
		out.v = at + dir * radius * angle
		out.w = radius - Math.sqrt(cv * cv + cw * cw)
		break
	}
	return out
}

/** Shapes the flat point `(u, v, w)` into the glove (the inverse of `unfold`), in inches. */
export function fold(u: number, v: number, w: number): Vec3 {
	let y = v,
		wc = w
	for (const { at, radius, dir } of BENDS) {
		if ((v - at) * dir <= 0) continue
		const angle = ((v - at) * dir) / radius,
			bend = radius - w
		y = at + dir * bend * Math.sin(angle)
		wc = radius - bend * Math.cos(angle)
		break
	}
	const angle = (u - FOLD_U) / FOLD_RADIUS,
		radius = FOLD_RADIUS - wc
	return [FOLD_U + radius * Math.sin(angle), y, FOLD_RADIUS - radius * Math.cos(angle)]
}

/**
 * Signed distance from `(x, y, z)`, in object radii, to the glove: never more than the true
 * distance, so sphere tracing can't step through it. Meant for points in its box (far outside it,
 * the unfolding wraps around).
 *
 * A flat distance `f` overstates the room by the most the shaping stretches space along the way
 * there. That's most nearest the fold's axis, and the way there gets no nearer than `f·stretch`,
 * nor nearer than any point of the box gets, so scaling by the stretch correction there is safe.
 */
export function gloveDistance(x: number, y: number, z: number) {
	const p = unfold(x * SIZE + CENTER[0], y * SIZE + CENTER[1], z * SIZE + CENTER[2])
	const f = flatDistance(p.u, p.v, p.w)
	if (f <= 0) return (f * p.stretch) / SIZE
	return (f * stretchAt(Math.max(p.fold - f * p.stretch, NEAREST_FOLD))) / SIZE
}

// --- Materials ---

const fract = (t: number) => t - Math.floor(t)

/** Left of these, and below the last, a part can't be the nearest to a point on the surface. */
const THUMB_FROM = THUMB.au - THUMB.r0 - 0.5
const WEB_FROM = Math.min(...WEB_OUTLINE.map(([u]) => u)) - 0.5
const FINGERS_FROM = Math.min(...FINGERS.map((f) => f.av - f.r0)) - 0.5

/** What the flat glove's surface is made of at `(u, v, w)`. */
export function flatMaterial(u: number, v: number, w: number) {
	// Whichever part is nearest owns the point. The web and thumb are only on the thumb side, and
	// the stalls only above the heel, so skip them elsewhere
	const palm = Math.min(palmDistance(u, v, w), heelDistance(u, v, w))
	const thumb = u > THUMB_FROM ? stallDistance(THUMB, u, v, w) : Infinity
	const web = u > WEB_FROM ? webDistance(u, v, w) : Infinity
	let finger = Infinity,
		next = Infinity,
		which = 0
	for (let i = 0; i < FINGERS.length && v > FINGERS_FROM; i++) {
		const d = stallDistance(FINGERS[i], u, v, w)
		if (d < finger) {
			next = finger
			finger = d
			which = i
		} else if (d < next) next = d
	}
	const nearest = Math.min(palm, thumb, web, finger)

	// The hand opening, lined inside (it's cut into the back)
	if (w < PALM.w && openingDistance(u, v, w) < 0.12) return LINING

	// Welted seams down the creases between the stalls
	if (nearest === finger && next - finger < SEAM_WIDTH && v > 0.6) return SEAM

	if (nearest === web) {
		// The I-web: a top bar and a post up the middle, laced across to either side
		const [pu0, pv0, pu1, pv1] = WEB.post
		const t = (v - pv0) / (pv1 - pv0)
		const post = pu0 + (pu1 - pu0) * t
		if (webOutline(u, v) > -WEB.bar && v > 2.6) return LEATHER
		if (Math.abs(u - post) < 0.32) return LEATHER
		return fract(v / WEB.rung) < 0.36 ? LACE : WEB_GAP
	}

	if (nearest === finger || nearest === thumb) {
		const s = nearest === thumb ? THUMB : FINGERS[which]
		const h = along(s, u, v)
		const axis = s.au + s.du * h
		// A lace loops over each fingertip, front to back
		if (v > s.top - 0.85 && Math.abs(u - axis) < 0.17) return LACE
	}

	// The heel's bottom edge is bound with lacing wound around the roll
	if (v < HEEL.v - 0.25)
		return fract(u / 0.5 + Math.atan2(w - HEEL.w, v - HEEL.v) / Math.PI) < 0.32 ? LACE : LEATHER
	// The pocket, on the palm's face
	if (nearest === palm && w > PALM.w + 0.1) {
		const pu = (u - POCKET_AREA.u) / POCKET_AREA.ru,
			pv = (v - POCKET_AREA.v) / POCKET_AREA.rv
		if (pu * pu + pv * pv < 1) return POCKET
	}
	return LEATHER
}

/** What the glove's surface is made of at `(x, y, z)` (object radii), a point on it. */
export function gloveMaterial(x: number, y: number, z: number) {
	const p = unfold(x * SIZE + CENTER[0], y * SIZE + CENTER[1], z * SIZE + CENTER[2])
	return flatMaterial(p.u, p.v, p.w)
}

// --- Intersection ---

/** The glove's bounding box in inches, a little padded (the test checks it holds it). */
const BOX_MIN: Vec3 = [-2.55, -5.45, -0.8]
const BOX_MAX: Vec3 = [5.7, 6.05, 3.1]
/** Nearest the fold's axis any point of the box (and the grid padding it) comes. */
const NEAREST_FOLD = FOLD_RADIUS - BOX_MAX[2] - 0.3
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
/** Whether the far field has been tightened since. */
let tightened = false

/**
 * Fills the distance grid, a slice at a time until `deadline` (a `performance.now()` time), so
 * the one-time cost (about 75k samples) can be spread over a few frames, then tightens it. True
 * once it's ready.
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
	if (filled < nz || performance.now() >= deadline) return false
	if (!tightened) {
		tighten(values, nx, ny, nz)
		tightened = true
	}
	return true
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
 * The shaping makes the exact distances cautious, most in front of the pocket, which slows
 * tracing there. The straight-line distance to the nearest sample inside the glove, less the
 * most that can be off by (a thin wall between samples, and trilinear lookups between them), is
 * also never more than the true distance, and far tighter away from the surface. Keep the larger.
 */
function tighten(values: Float32Array, nx: number, ny: number, nz: number) {
	const squared = new Float64Array(values.length)
	for (let i = 0; i < values.length; i++) squared[i] = values[i] < 0 ? 0 : FAR
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
	const slack = (Math.sqrt(3) * 1.5 + 0.2) * VOXEL
	for (let i = 0; i < values.length; i++) {
		if (values[i] <= 0) continue
		const far = Math.sqrt(squared[i]) * VOXEL - slack
		if (far > values[i]) values[i] = far
	}
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

/** Turning about the vertical, tipped back a little. */
const SPIN_AXIS: Vec3 = normalize([0.05, 1, 0.1])
/** Starts turned this far toward its thumb side, where the web and the pocket show best. */
const HEADING = 0.55

export const GLOVE: Shape = {
	name: 'baseball glove',
	materials: MATERIALS,
	// Sphere tracing costs more per sample than the others, so blur a fast spin over fewer steps
	blurSteps: 3,

	start(random = Math.random) {
		const tilt = quatFromRotation([-0.22, 0, 0])
		const heading = quatFromRotation(scale(SPIN_AXIS, HEADING + (random() - 0.5) * 0.5))
		return {
			orientation: quatMul(heading, tilt),
			// Turning toward the front, so the pocket comes around before the back does
			spin: scale(SPIN_AXIS, -IDLE_SPIN),
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
