/**
 * Geometry for the home run chart on /game/[gamePk]: a top-down ballpark built from the
 * venue's published fence distances, and each home run's landing spot in feet.
 *
 * Feet are measured from home plate with +x toward right field and +y toward center field.
 * The SVG flips y, so a point is drawn at (x, -y).
 */

/** Gameday hit-chart pixel where home plate sits. y grows toward home. */
export const HIT_CHART_HOME = { x: 125.42, y: 198.27 } as const

/** Feet per hit-chart pixel. Checked against `totalDistance` across a season of home runs. */
export const HIT_CHART_SCALE = 2.5

/** Used when the venue has no `fieldInfo` (or only part of it). */
export const GENERIC_FIELD = {
	leftLine: 330,
	leftCenter: 375,
	center: 400,
	rightCenter: 375,
	rightLine: 330,
} as const

/** Spray angle (degrees, 0 = straight away center, negative = left) of each fence distance. */
const FENCE_ANGLES = [-45, -22.5, 0, 22.5, 45] as const

export type Point = { x: number; y: number }

export type FieldDirection = 'LF' | 'LCF' | 'CF' | 'RCF' | 'RF'

export const DIRECTION_LABELS: Record<FieldDirection, string> = {
	LF: 'Left field',
	LCF: 'Left-center',
	CF: 'Center field',
	RCF: 'Right-center',
	RF: 'Right field',
}

/** Middle of each direction's slice of the field, used when a ball has no coordinates. */
const DIRECTION_ANGLES: Record<FieldDirection, number> = {
	LF: -36,
	LCF: -20,
	CF: 0,
	RCF: 20,
	RF: 36,
}

const DIRECTION_FROM_DESC: [RegExp, FieldDirection][] = [
	[/left[\s-]+center\s+field/i, 'LCF'],
	[/right[\s-]+center\s+field/i, 'RCF'],
	[/left[\s-]+field/i, 'LF'],
	[/right[\s-]+field/i, 'RF'],
	[/center\s+field/i, 'CF'],
]

export function fenceDistances(fieldInfo?: MLB.FieldInfo): number[] {
	return (['leftLine', 'leftCenter', 'center', 'rightCenter', 'rightLine'] as const).map(
		(key) => fieldInfo?.[key] || GENERIC_FIELD[key],
	)
}

/**
 * Fence distance at a spray angle: a Catmull-Rom curve through the five published
 * distances, so the wall bends smoothly between them. Clamped to the foul poles.
 */
export function fenceDistanceAt(distances: number[], angle: number): number {
	const a = Math.max(-45, Math.min(45, angle))
	const step = 22.5
	const i = Math.min(3, Math.floor((a + 45) / step))
	const t = (a - FENCE_ANGLES[i]) / step

	const p1 = distances[i]
	const p2 = distances[i + 1]
	// Mirror the ends so the curve meets the foul poles without overshooting.
	const p0 = distances[i - 1] ?? 2 * p1 - p2
	const p3 = distances[i + 2] ?? 2 * p2 - p1

	const t2 = t * t
	const t3 = t2 * t
	return (
		0.5 *
		(2 * p1 +
			(-p0 + p2) * t +
			(2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
			(-p0 + 3 * p1 - 3 * p2 + p3) * t3)
	)
}

export function polar(angle: number, distance: number): Point {
	const rad = (angle * Math.PI) / 180
	return { x: Math.sin(rad) * distance, y: Math.cos(rad) * distance }
}

export function angleOf({ x, y }: Point): number {
	return (Math.atan2(x, y) * 180) / Math.PI
}

export function distanceOf({ x, y }: Point): number {
	return Math.hypot(x, y)
}

/** Points along the outfield wall from the left-field pole to the right-field pole. */
export function fencePoints(distances: number[], stepDegrees = 1.5): Point[] {
	const points: Point[] = []
	for (let angle = -45; angle <= 45 + 1e-9; angle += stepDegrees) {
		points.push(polar(angle, fenceDistanceAt(distances, angle)))
	}
	return points
}

export function hitChartToFeet(coordX: number, coordY: number): Point {
	return {
		x: HIT_CHART_SCALE * (coordX - HIT_CHART_HOME.x),
		y: HIT_CHART_SCALE * (HIT_CHART_HOME.y - coordY),
	}
}

export function directionFromAngle(angle: number): FieldDirection {
	if (angle < -30) return 'LF'
	if (angle < -9) return 'LCF'
	if (angle <= 9) return 'CF'
	if (angle <= 30) return 'RCF'
	return 'RF'
}

export function directionFromDescription(description?: string): FieldDirection | undefined {
	if (!description) return undefined
	for (const [pattern, direction] of DIRECTION_FROM_DESC) {
		if (pattern.test(description)) return direction
	}
}

export function isInsideTheParkHomeRun(description?: string) {
	return /inside[\s-]the[\s-]park/i.test(description ?? '')
}

/**
 * Where a home run landed, in feet from home plate.
 *
 * Gameday coordinates give the direction (and usually the distance). Over-the-fence home
 * runs whose coordinates fall short of the wall are pushed out to `totalDistance` (or just
 * past the fence), and inside-the-park ones are kept inside it. Without coordinates, the
 * ball goes `totalDistance` feet in the direction the play description names.
 */
export function landingSpot({
	hitData,
	description,
	distances,
}: {
	hitData?: MLB.HitData
	description?: string
	distances: number[]
}): Point {
	const { coordX, coordY } = hitData?.coordinates ?? {}
	const insideThePark = isInsideTheParkHomeRun(description)
	const fromCoordinates = coordX != null && coordY != null ? hitChartToFeet(coordX, coordY) : null

	const angle = fromCoordinates
		? angleOf(fromCoordinates)
		: DIRECTION_ANGLES[directionFromDescription(description) ?? 'CF']
	const fence = fenceDistanceAt(distances, angle)

	let distance =
		(fromCoordinates && distanceOf(fromCoordinates)) || hitData?.totalDistance || fence + 25

	if (insideThePark) {
		distance = Math.min(distance, fence - 15)
	} else if (distance < fence + 5) {
		distance = Math.max(hitData?.totalDistance ?? 0, fence + 12)
	}

	return polar(angle, distance)
}

/**
 * Nudges points apart until none are closer than `minGap`, so landing dots that overlap
 * stay individually clickable. Returns new points in the same order.
 */
export function separate(points: Point[], minGap: number, iterations = 24): Point[] {
	const out = points.map((p) => ({ ...p }))

	for (let n = 0; n < iterations; n++) {
		let moved = false

		for (let i = 0; i < out.length; i++) {
			for (let j = i + 1; j < out.length; j++) {
				let dx = out[j].x - out[i].x
				let dy = out[j].y - out[i].y
				let d = Math.hypot(dx, dy)
				if (d >= minGap) continue

				if (d < 1e-6) {
					// Same spot: fan them out sideways, perpendicular to the ball's flight.
					const len = Math.hypot(out[i].x, out[i].y) || 1
					dx = -out[i].y / len
					dy = out[i].x / len
					d = 1
				} else {
					dx /= d
					dy /= d
				}

				const push = (minGap - d) / 2
				out[i].x -= dx * push
				out[i].y -= dy * push
				out[j].x += dx * push
				out[j].y += dy * push
				moved = true
			}
		}

		if (!moved) break
	}

	return out
}

/**
 * A quadratic curve from home plate to `end`. Its control point sits off the midpoint
 * by an amount that grows with launch angle, so higher fly balls draw taller arcs. The
 * bulge always leans toward the outfield, like a flight seen from slightly behind home.
 */
export function flightPath(end: Point, launchAngle = 28): { d: string; control: Point } {
	const distance = distanceOf(end) || 1
	const ux = end.x / distance
	const uy = end.y / distance

	// Of the two perpendiculars, take the one that points further toward center field.
	let px = -uy
	let py = ux
	if (py < 0 || (py === 0 && px > 0)) {
		px = -px
		py = -py
	}

	const angle = Math.max(10, Math.min(50, launchAngle))
	const bulge = distance * (0.05 + angle * 0.004)

	const control = {
		x: end.x / 2 + px * bulge,
		y: end.y / 2 + py * bulge,
	}

	return {
		d: `M0 0Q${round(control.x)} ${round(-control.y)} ${round(end.x)} ${round(-end.y)}`,
		control,
	}
}

export function round(n: number) {
	return Math.round(n * 10) / 10
}

export function toPath(points: Point[]) {
	return points.map((p, i) => `${i ? 'L' : 'M'}${round(p.x)} ${round(-p.y)}`).join('')
}

type Oklch = { l: number; c: number; h: number }

function hexToOklch(hex: string): Oklch {
	const n = parseInt(hex.replace('#', ''), 16)
	const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
		const s = v / 255
		return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
	})

	const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
	const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
	const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

	const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
	const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
	const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

	return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

function oklchString({ l, c, h }: Oklch) {
	return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`
}

function oklchDistance(a: Oklch, b: Oklch) {
	const ra = (a.h * Math.PI) / 180
	const rb = (b.h * Math.PI) / 180
	return Math.hypot(
		a.l - b.l,
		a.c * Math.cos(ra) - b.c * Math.cos(rb),
		a.c * Math.sin(ra) - b.c * Math.sin(rb),
	)
}

export type ChartColor = { light: string; dark: string }

/**
 * Team colors legible on both themes: the same hue, pushed dark enough for a light
 * background and light enough for a dark one. Club colors are mostly navy and black,
 * so when the two teams would read alike, the home side switches to `fallback`.
 */
export function teamChartColors(awayHex: string, homeHex: string, fallback: string) {
	const tune = (hex: string) => {
		const color = hexToOklch(hex)
		return {
			light: { ...color, l: Math.min(color.l, 0.55) },
			dark: { ...color, l: Math.max(color.l, 0.74) },
		}
	}

	const away = tune(awayHex)
	let home = tune(homeHex)

	if (oklchDistance(away.dark, home.dark) < 0.08 || oklchDistance(away.light, home.light) < 0.08) {
		home = tune(fallback)
	}

	const toStrings = (c: { light: Oklch; dark: Oklch }): ChartColor => ({
		light: oklchString(c.light),
		dark: oklchString(c.dark),
	})

	return { away: toStrings(away), home: toStrings(home) }
}
