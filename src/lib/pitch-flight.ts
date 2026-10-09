/**
 * Pitch flight and spin from Statcast's pitch data.
 *
 * Coordinates are in feet, from the catcher's view: `x` is toward the
 * catcher's right (first base), `y` is from the back tip of home plate toward
 * the mound, and `z` is up from the ground.
 */

/** Statcast reports `pX` / `pZ` where the ball crosses the front of the plate. */
export const PLATE_FRONT_Y = 17 / 12
/** The mound's rubber, used with `extension` to find the release point. */
const RUBBER_Y = 60.5
/** Where the 9-parameter fit is anchored. */
const FIT_Y = 50
/** Regulation baseball diameter (2.9"), in feet. */
export const BALL_RADIUS = 2.9 / 24

export type FlightPoint = { x: number; y: number; z: number; t: number }

/**
 * Smaller root of `0.5·a·t² + b·t + c = 0` in a form that stays accurate when
 * `a` is tiny or zero. With `b < 0` (the ball heading toward the plate) it's
 * the time the ball reaches `y`, before or after the fit's `y0`.
 */
function timeAtY(y0: number, vY0: number, aY: number, y: number) {
	const a = 0.5 * aY
	const b = vY0
	const c = y0 - y
	const disc = b * b - 4 * a * c
	if (disc < 0 || b === 0) return null
	const q = -0.5 * (b + Math.sign(b) * Math.sqrt(disc))
	return q === 0 ? null : c / q
}

/**
 * The ball's path from release to the front of the plate, from the
 * 9-parameter constant-acceleration fit: `p(t) = p0 + v0·t + ½·a·t²`. `null`
 * when any parameter is missing or the fit doesn't reach the plate.
 *
 * The fit is extrapolated back to the release point (`60.5 ft − extension`)
 * the way Statcast does. If it lands a hair off `pX` / `pZ` (rounding in the
 * feed), the difference is eased in toward the plate so the path ends exactly
 * on the reported location.
 */
export function pitchFlight(
	pitchData: MLB.PitchData | undefined,
	steps = 32,
): FlightPoint[] | null {
	const c = pitchData?.coordinates
	if (!c) return null
	const { x0, z0, vX0, vY0, vZ0, aX, aY, aZ, pX, pZ } = c
	const y0 = c.y0 ?? FIT_Y
	const params = [x0, z0, vX0, vY0, vZ0, aX, aY, aZ, pX, pZ]
	if (!params.every((v) => typeof v === 'number' && Number.isFinite(v))) return null
	if (vY0! >= 0) return null

	const extension = pitchData?.extension
	const releaseY = typeof extension === 'number' && extension > 0 ? RUBBER_Y - extension : y0

	const tPlate = timeAtY(y0, vY0!, aY!, PLATE_FRONT_Y)
	const tRelease = timeAtY(y0, vY0!, aY!, releaseY)
	if (tPlate == null || tRelease == null || !(tPlate > tRelease)) return null

	const at = (t: number) => ({
		x: x0! + vX0! * t + 0.5 * aX! * t * t,
		y: y0 + vY0! * t + 0.5 * aY! * t * t,
		z: z0! + vZ0! * t + 0.5 * aZ! * t * t,
	})

	// Should be within rounding of the reported location; a big miss means
	// the fit and the location disagree, so don't draw a path at all.
	const end = at(tPlate)
	const dx = pX! - end.x
	const dz = pZ! - end.z
	if (Math.hypot(dx, dz) > 0.5) return null

	const points: FlightPoint[] = []
	for (let i = 0; i <= steps; i++) {
		// The ball sweeps across the screen fastest as it nears the camera, so
		// sample more densely toward the plate.
		const u = Math.sqrt(i / steps)
		const t = tRelease + (tPlate - tRelease) * u
		const p = at(t)
		const ease = u * u
		points.push({ x: p.x + dx * ease, y: p.y, z: p.z + dz * ease, t: t - tRelease })
	}
	return points
}

/**
 * A pinhole camera behind home plate, looking out at the mound. Points are
 * projected onto the plane of the front of the plate, so anything at the
 * plate (the zone, `pX` / `pZ`) keeps its true size in feet and things
 * farther out shrink toward the camera's eye height.
 */
export type Camera = {
	/** Feet behind the front of the plate. */
	distance: number
	/** Eye height, feet. */
	height: number
}

/**
 * Roughly a low home-plate camera: far enough back that the ground-level
 * plate and the release points fit with the zone, close enough that the ball
 * still visibly grows on its way in.
 */
export const UMPIRE_CAMERA: Camera = { distance: 15, height: 3.5 }

export function project(camera: Camera, x: number, y: number, z: number) {
	const depth = Math.max(0.1, camera.distance + y - PLATE_FRONT_Y)
	const scale = camera.distance / depth
	return {
		x: x * scale,
		z: camera.height + (z - camera.height) * scale,
		/** Size relative to the same object at the plate. */
		scale,
	}
}

/**
 * Statcast's spin axis (`spinDirection`): degrees around the clock of the
 * spin-induced movement, with 180° pure backspin (the ball rides up), 0° pure
 * topspin, 90° breaking toward the first-base side (catcher's right) and 270°
 * toward the third-base side. A right-hander's four-seamer sits around 210°
 * and a right-hander's curveball near 30–60°.
 */
export type SpinAxis = { x: number; y: number; z: number }

/**
 * Unit spin vector (right-hand rule) in field coordinates. The ball travels
 * toward −y, and the Magnus force is along ω × v, so movement direction
 * `m = (sin θ, 0, −cos θ)` comes from `ω = (cos θ, 0, sin θ)`. Gyro spin isn't
 * reported, so the axis lies in the plane facing the catcher.
 */
export function spinAxis(spinDirection: number): SpinAxis {
	const theta = (spinDirection * Math.PI) / 180
	return { x: Math.cos(theta), y: 0, z: Math.sin(theta) }
}

/**
 * Real spin (≈1,200–3,200 rpm) is a blur; slow it to a watchable rate that
 * keeps the ratio between pitches, so a 3,000 rpm curveball still turns
 * visibly faster than a 1,500 rpm changeup.
 */
export function visibleSpinRevsPerSecond(spinRate: number) {
	return Math.max(0, spinRate) / 2000
}
