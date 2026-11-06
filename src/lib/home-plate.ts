/**
 * The homepage's ASCII home plate (`#ui/ascii-object.svelte`): a whitened rubber slab, 17"
 * across the front, with 8.5" sides and 12" edges meeting at the point, and a dark beveled rim.
 *
 * The plate lies in its local xy plane with its top facing +z and its point toward −y, in object
 * radii (it's scaled to just fit the unit sphere).
 */

import {
	castLocal,
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

export const TOP = 0
export const RUBBER = 1

const MATERIALS: Material[] = [
	// Whitened rubber, scuffed just enough that its lit face draws in light ink on a light page
	{ albedo: 0.82, sheen: 0.14 },
	// The black bevel and sides
	{ albedo: 0.2, sheen: 0.08 },
]

// --- Geometry, in inches ---

const WIDTH = 17
const SIDE = 8.5
const POINT_EDGE = 12
/** Thicker than a real plate (they sit flush with the dirt), so its edge shows. */
const THICKNESS = 1.6
/** How far the white top is inset from the outline, and how far the bevel drops. */
const BEVEL = 1.1
const BEVEL_DROP = 0.9

/** How far the point reaches past the sides: the rest of a 12" edge. */
const POINT_DEPTH = Math.sqrt(POINT_EDGE ** 2 - (WIDTH / 2) ** 2)

/** The outline counterclockwise from the front-left corner, before centering. */
const RAW: [number, number][] = [
	[-WIDTH / 2, SIDE],
	[-WIDTH / 2, 0],
	[0, -POINT_DEPTH],
	[WIDTH / 2, 0],
	[WIDTH / 2, SIDE],
]

/**
 * Center the plate spins about: on its axis of symmetry, where its farthest corner is nearest
 * (the front corners and the point end up equidistant).
 */
const CENTER_Y = (() => {
	const reach = (c: number) => Math.max(...RAW.map(([x, y]) => Math.hypot(x, y - c)))
	let lo = -POINT_DEPTH,
		hi = SIDE
	for (let i = 0; i < 60; i++) {
		const a = lo + (hi - lo) / 3,
			b = hi - (hi - lo) / 3
		if (reach(a) < reach(b)) hi = b
		else lo = a
	}
	return (lo + hi) / 2
})()

/** Inches → object radii. */
const UNIT =
	Math.hypot(Math.max(...RAW.map(([x, y]) => Math.hypot(x, y - CENTER_Y))), THICKNESS / 2) * 1.01

/** The outline's corners, centered, in object radii. */
export const PLATE_CORNERS: [number, number][] = RAW.map(([x, y]) => [
	x / UNIT,
	(y - CENTER_Y) / UNIT,
])

export const PLATE_HALF_THICKNESS = THICKNESS / 2 / UNIT

/** Faces as half-spaces `n·p ≤ d` (unit outward normal `n`), each with its material. */
interface Face {
	nx: number
	ny: number
	nz: number
	d: number
	material: number
}

export const PLATE_FACES: Face[] = (() => {
	const h = PLATE_HALF_THICKNESS
	const bevel = BEVEL / UNIT
	const drop = BEVEL_DROP / UNIT
	const faces: Face[] = [
		{ nx: 0, ny: 0, nz: 1, d: h, material: TOP },
		{ nx: 0, ny: 0, nz: -1, d: h, material: RUBBER },
	]
	PLATE_CORNERS.forEach(([x0, y0], i) => {
		const [x1, y1] = PLATE_CORNERS[(i + 1) % PLATE_CORNERS.length]
		// Counterclockwise, so the outward normal is the edge turned clockwise
		const len = Math.hypot(x1 - x0, y1 - y0)
		const ex = (y1 - y0) / len,
			ey = -(x1 - x0) / len
		const d = ex * x0 + ey * y0
		faces.push({ nx: ex, ny: ey, nz: 0, d, material: RUBBER })
		// The bevel runs from the top's inset edge down `drop` to the outline
		const slope = bevel / drop
		const [nx, ny, nz] = normalize([ex, ey, slope])
		const norm = Math.hypot(ex, ey, slope)
		faces.push({ nx, ny, nz, d: (d - bevel + slope * h) / norm, material: RUBBER })
	})
	return faces
})()

// --- Intersection ---

const FACE_COUNT = PLATE_FACES.length
const FN = new Float64Array(FACE_COUNT * 4)
PLATE_FACES.forEach(({ nx, ny, nz, d }, i) => FN.set([nx, ny, nz, d], i * 4))

/** The plate is convex, so a ray is inside it between the last face it enters and the first it leaves. */
export const intersectPlate: Intersect = (ox, oy, oz, dx, dy, dz, hit) => {
	let enter = 0,
		exit = Infinity,
		face = -1
	for (let i = 0; i < FACE_COUNT; i++) {
		const nx = FN[i * 4],
			ny = FN[i * 4 + 1],
			nz = FN[i * 4 + 2]
		const toward = nx * dx + ny * dy + nz * dz
		const gap = FN[i * 4 + 3] - (nx * ox + ny * oy + nz * oz)
		if (Math.abs(toward) < 1e-12) {
			if (gap < 0) return false
			continue
		}
		const t = gap / toward
		if (toward < 0) {
			if (t > enter) {
				enter = t
				face = i
			}
		} else if (t < exit) exit = t
		if (enter > exit) return false
	}
	if (face < 0) return false
	const f = PLATE_FACES[face]
	hit.nx = f.nx
	hit.ny = f.ny
	hit.nz = f.nz
	hit.material = f.material
	return true
}

// --- Shape ---

/** Seen from in front and above, the way it sits in the dirt, turning flat like a turntable. */
const FACING: Vec3 = normalize([0, 0.62, 0.78])

export const HOME_PLATE: Shape = {
	name: 'home plate',
	materials: MATERIALS,

	start(random = Math.random) {
		const tilt = quatFromRotation(rotationBetween([0, 0, 1], FACING))
		const heading = quatFromRotation([0, 0, random() * 2 * Math.PI])
		return {
			orientation: quatMul(tilt, heading),
			spin: scale(FACING, IDLE_SPIN),
		}
	},

	view(m: Mat3) {
		return castLocal(m, intersectPlate)
	},
}
