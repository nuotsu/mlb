/**
 * The homepage's ASCII baseball bat (`#ui/ascii-object.svelte`): a wood bat turned on a lathe,
 * with a knob, a taped handle, a long taper into the barrel, and a cupped end.
 *
 * The bat's axis is its local z, knob at −z and barrel at +z, in object radii (half its length).
 */

import {
	castLocal,
	cross,
	IDLE_SPIN,
	normalize,
	quatFromRotation,
	quatMul,
	rotationBetween,
	scale,
	type Intersect,
	type Mat3,
	type Material,
	type Shape,
	type Vec3,
} from './ascii-3d.js'

export const WOOD = 0
export const TAPE = 1
export const LOGO = 2

const MATERIALS: Material[] = [
	// Lacquered ash: light, with a soft shine
	{ albedo: 0.8, sheen: 0.35 },
	// Grip tape: dark and matte
	{ albedo: 0.32, sheen: 0.02 },
	// The brand's oval, burned into the barrel
	{ albedo: 0.22, sheen: 0.12 },
]

// --- Profile ---

/** A regulation-ish 34" wood bat, in inches from the knob. */
const LENGTH = 34
const KNOB = 0.8
const HANDLE = 0.47
const BARREL = 1.27
const CUP = 0.8
const CUP_DEPTH = 0.55

/** Real proportions draw the handle a single character thin, so everything's a bit stouter. */
const stout = (r: number) => 1.5 * r + 0.28

/** Where the tape ends and where the logo sits, in inches from the knob. */
const TAPE_END = 10
const LOGO_AT = 21.5
const LOGO_LENGTH = 1.9
const LOGO_WIDTH = 0.95

const smootherstep = (u: number) => u * u * u * (u * (u * 6 - 15) + 10)

/**
 * The bat's outline as `[radius, inches from knob]` points, from the middle of the knob's end,
 * out and along the bat to the barrel's rim, and into the cup to its center.
 */
function outline(): [number, number][] {
	const points: [number, number][] = []
	const arc = (cr: number, cs: number, radius: number, from: number, to: number, steps: number) => {
		for (let i = 0; i <= steps; i++) {
			const a = from + ((to - from) * i) / steps
			points.push([cr + radius * Math.cos(a), cs + radius * Math.sin(a)])
		}
	}

	// Knob: a flat end, a rounded rim, then a fillet down into the handle
	const knob = stout(KNOB)
	const corner = 0.2
	points.push([0, 0])
	arc(knob - corner, corner, corner, -Math.PI / 2, 0, 3)
	points.push([knob, 0.32])
	const filletFrom = 0.42,
		filletTo = 1.25
	for (let i = 0; i <= 5; i++) {
		const u = i / 5
		points.push([
			stout(HANDLE) + (knob - 0.06 - stout(HANDLE)) * (1 - u) ** 2,
			filletFrom + (filletTo - filletFrom) * u,
		])
	}

	// Handle, taper and barrel
	const radiusAt = (s: number) => {
		if (s < 11) return HANDLE + 0.03 * ((s - filletTo) / (11 - filletTo))
		if (s < 25) return HANDLE + 0.03 + (BARREL - HANDLE - 0.03) * smootherstep((s - 11) / 14)
		return BARREL + 0.02 * ((s - 25) / (LENGTH - 25))
	}
	const rim = 0.35
	for (let s = 2; s < LENGTH - rim; s += s < 10 || s > 26 ? 3 : 1)
		points.push([stout(radiusAt(s)), s])

	// Rounded rim, the end's flat ring, and the cup: a spherical dish
	const barrel = stout(radiusAt(LENGTH))
	arc(barrel - rim, LENGTH - rim, rim, 0, Math.PI / 2, 4)
	const cupRadius = (CUP * CUP + CUP_DEPTH * CUP_DEPTH) / (2 * CUP_DEPTH)
	const rise = Math.atan2(CUP_DEPTH - cupRadius, CUP)
	arc(0, LENGTH - CUP_DEPTH + cupRadius, cupRadius, rise, -Math.PI / 2, 6)
	points[points.length - 1][0] = 0

	return points
}

/** Inches → object radii, sized so the barrel's rim just fits in the unit sphere. */
const OUTLINE = outline()
const UNIT = Math.max(...OUTLINE.map(([r, s]) => Math.hypot(r, s - LENGTH / 2))) * 1.01
const toZ = (s: number) => (s - LENGTH / 2) / UNIT

/** Widest radius, for a quick bounding-cylinder test. */
export const BAT_RADIUS = Math.max(...OUTLINE.map(([r]) => r)) / UNIT

/** Facets this much sharper than their neighbors keep a crisp edge instead of a smooth one. */
const CREASE = Math.cos((40 * Math.PI) / 180)

interface Segment {
	r0: number
	z0: number
	r1: number
	z1: number
	zLo: number
	zHi: number
	rLo: number
	rHi: number
	/** Radius as a function of z on the segment's cone: `r = a + k·z`. */
	k: number
	a: number
	/** Outward normals at each end, `[radial, axial]`, blended across the segment. */
	start: [number, number]
	end: [number, number]
}

const SEGMENTS: Segment[] = (() => {
	// Snap heights that only differ by rounding, so flat rings stay flat instead of turning into
	// cones steep enough to sweep across the whole end
	const pts = OUTLINE.map(([r, s]) => [r / UNIT, Math.round(toZ(s) * 1e9) / 1e9] as const)
	// Walking the outline, the bat is on the left, so its outward normal is the step turned right
	const facets = pts.slice(1).map(([r1, z1], i) => {
		const [r0, z0] = pts[i]
		const len = Math.hypot(r1 - r0, z1 - z0)
		return [(z1 - z0) / len, -(r1 - r0) / len] as [number, number]
	})
	const blend = (a: [number, number], b: [number, number]): [number, number] => {
		if (a[0] * b[0] + a[1] * b[1] < CREASE) return a
		const len = Math.hypot(a[0] + b[0], a[1] + b[1])
		return [(a[0] + b[0]) / len, (a[1] + b[1]) / len]
	}

	return facets.map((normal, i) => {
		const [r0, z0] = pts[i]
		const [r1, z1] = pts[i + 1]
		const k = z1 === z0 ? 0 : (r1 - r0) / (z1 - z0)
		return {
			r0,
			z0,
			r1,
			z1,
			zLo: Math.min(z0, z1),
			zHi: Math.max(z0, z1),
			rLo: Math.min(r0, r1),
			rHi: Math.max(r0, r1),
			k,
			a: r0 - k * z0,
			start: i > 0 ? blend(normal, facets[i - 1]) : normal,
			end: i < facets.length - 1 ? blend(normal, facets[i + 1]) : normal,
		}
	})
})()

const Z_MIN = Math.min(...SEGMENTS.map((s) => s.zLo))
const Z_MAX = Math.max(...SEGMENTS.map((s) => s.zHi))

/** Radius of the bat at `z` along its axis (the outer surface, ignoring the cup). */
export function batRadius(z: number) {
	let r = 0
	for (const s of SEGMENTS) {
		if (z < s.zLo || z > s.zHi || s.z0 === s.z1) continue
		r = Math.max(r, s.a + s.k * z)
	}
	return r
}

// --- Intersection ---

const TAPE_Z = toZ(TAPE_END)
const LOGO_Z = toZ(LOGO_AT)
const LOGO_DZ = LOGO_LENGTH / UNIT
const LOGO_ANGLE = LOGO_WIDTH / stout(BARREL)

function materialAt(x: number, y: number, z: number) {
	if (z < TAPE_Z) return TAPE
	const along = (z - LOGO_Z) / LOGO_DZ
	if (along * along < 1 && x > 0) {
		const around = Math.atan2(y, x) / LOGO_ANGLE
		if (along * along + around * around < 1) return LOGO
	}
	return WOOD
}

/** Whether the point `t` along the ray lies on the segment's own stretch of its cone. */
function onSegment(
	s: Segment,
	ox: number,
	oy: number,
	oz: number,
	dx: number,
	dy: number,
	dz: number,
	t: number,
) {
	if (!(t > 0)) return false
	const z = oz + t * dz
	if (z < s.zLo - 1e-9 || z > s.zHi + 1e-9) return false
	const r = Math.hypot(ox + t * dx, oy + t * dy)
	return r >= s.rLo - 1e-6 && r <= s.rHi + 1e-6
}

export const intersectBat: Intersect = (ox, oy, oz, dx, dy, dz, hit) => {
	// Clip the ray to the bat's bounding cylinder, and only test segments in its span of z
	const a = dx * dx + dy * dy
	const b = ox * dx + oy * dy
	const c = ox * ox + oy * oy - BAT_RADIUS * BAT_RADIUS
	let zLo = Z_MIN,
		zHi = Z_MAX
	if (a > 1e-12) {
		const disc = b * b - a * c
		if (disc < 0) return false
		const sq = Math.sqrt(disc)
		const za = oz + ((-b - sq) / a) * dz,
			zb = oz + ((-b + sq) / a) * dz
		zLo = Math.max(zLo, Math.min(za, zb))
		zHi = Math.min(zHi, Math.max(za, zb))
		if (zLo > zHi) return false
	} else if (c > 0) return false

	let best = Infinity
	let seg: Segment | undefined
	let along = 0
	for (const s of SEGMENTS) {
		if (s.zHi < zLo || s.zLo > zHi) continue

		if (s.z0 === s.z1) {
			// A flat ring across the axis
			if (Math.abs(dz) < 1e-12) continue
			const t = (s.z0 - oz) / dz
			if (t <= 0 || t >= best) continue
			const r = Math.hypot(ox + t * dx, oy + t * dy)
			const u = (r - s.r0) / (s.r1 - s.r0)
			if (u < 0 || u > 1) continue
			best = t
			seg = s
			along = u
			continue
		}

		// A cone: x² + y² = (a + k·z)², on the nappe where a + k·z ≥ 0
		const ra = s.a + s.k * oz
		const qa = a - s.k * s.k * dz * dz
		const qb = b - s.k * dz * ra
		const qc = ox * ox + oy * oy - ra * ra
		let t0: number, t1: number
		if (Math.abs(qa) < 1e-12) {
			if (Math.abs(qb) < 1e-12) continue
			t0 = t1 = -qc / (2 * qb)
		} else {
			const disc = qb * qb - qa * qc
			if (disc < 0) continue
			const sq = Math.sqrt(disc)
			t0 = (-qb - sq) / qa
			t1 = (-qb + sq) / qa
			if (t0 > t1) [t0, t1] = [t1, t0]
		}
		// The nearer root that lands on this segment's stretch of the cone
		let t = t0
		if (!onSegment(s, ox, oy, oz, dx, dy, dz, t)) {
			t = t1
			if (!onSegment(s, ox, oy, oz, dx, dy, dz, t)) continue
		}
		if (t >= best) continue
		best = t
		seg = s
		// How far along the segment, measured the way it runs farther: across or along the axis
		along =
			Math.abs(s.z1 - s.z0) >= Math.abs(s.r1 - s.r0)
				? (oz + t * dz - s.z0) / (s.z1 - s.z0)
				: (Math.hypot(ox + t * dx, oy + t * dy) - s.r0) / (s.r1 - s.r0)
	}
	if (!seg) return false

	const x = ox + best * dx,
		y = oy + best * dy,
		z = oz + best * dz
	const nr = seg.start[0] + (seg.end[0] - seg.start[0]) * along
	const nz = seg.start[1] + (seg.end[1] - seg.start[1]) * along
	const r = Math.hypot(x, y)
	const [nx, ny, nnz] =
		r > 1e-9 ? normalize([(nr * x) / r, (nr * y) / r, nz]) : [0, 0, Math.sign(nz)]
	hit.nx = nx
	hit.ny = ny
	hit.nz = nnz
	hit.material = materialAt(x, y, z)
	return true
}

// --- Shape ---

/** Twirling about a diagonal in the picture, with the bat tipped off it so it wobbles too. */
const SPIN_AXIS: Vec3 = normalize([0.5, 0.82, 0.25])
/** Angle between the bat and its spin axis: small, so the bat never points at the viewer. */
const WOBBLE = 0.45

export const BAT: Shape = {
	name: 'baseball bat',
	materials: MATERIALS,

	start(random = Math.random) {
		// Lay the bat along the spin axis with a random roll, tip it off by the wobble, then turn it
		// to a random point around the cone it sweeps
		const roll = quatFromRotation([0, 0, random() * 2 * Math.PI])
		const along = quatFromRotation(rotationBetween([0, 0, 1], SPIN_AXIS))
		const tip = quatFromRotation(scale(normalize(cross(SPIN_AXIS, [0, 0, 1])), WOBBLE))
		const heading = quatFromRotation(scale(SPIN_AXIS, random() * 2 * Math.PI))
		return {
			orientation: quatMul(heading, quatMul(tip, quatMul(along, roll))),
			spin: scale(SPIN_AXIS, IDLE_SPIN),
		}
	},

	view(m: Mat3) {
		return castLocal(m, intersectBat)
	},
}
