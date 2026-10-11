/**
 * Where Gameday's batter render stands in the pitch sequence, in feet from the
 * catcher's view, the same space as the strike zone and `pX` / `pZ`: `x` is
 * toward the catcher's right (first base) from the middle of the plate, `z`
 * is up from the ground.
 */

/** Every batter render shares one canvas, in image px. */
export const CANVAS = { w: 496, h: 1050 }

/**
 * Landmarks on one render, measured once in image px on the canvas.
 *
 * - `head`: top of the helmet
 * - `ground`: the soles of the back (lowest) foot, which stand on the ground
 * - `hip`: the hips' centerline, where the batter stands in the box
 * - `bounds`: left, right, and top edges of what's drawn, bat and all
 * - `knee`, `belt`: the hollow of the back knee and the top of the pants, kept
 *   to check the fit against (see the tests)
 */
export type Calibration = {
	head: number
	ground: number
	hip: number
	bounds: { left: number; right: number; top: number }
	knee: number
	belt: number
}

/** Per season, as the renders' pose changes between them. Righties use `right`. */
const CALIBRATIONS: Record<number, Record<'L' | 'R', Calibration>> = {
	2025: {
		L: {
			head: 123,
			ground: 1044,
			hip: 255,
			bounds: { left: 14, right: 424, top: 4 },
			knee: 745,
			belt: 467,
		},
		R: {
			head: 121,
			ground: 1039,
			hip: 239,
			bounds: { left: 75, right: 481, top: 4 },
			knee: 758,
			belt: 463,
		},
	},
	2026: {
		L: {
			head: 117,
			ground: 1048,
			hip: 231,
			bounds: { left: 2, right: 495, top: 43 },
			knee: 758,
			belt: 470,
		},
		R: {
			head: 117,
			ground: 1049,
			hip: 263,
			bounds: { left: 1, right: 494, top: 43 },
			knee: 740,
			belt: 470,
		},
	},
}

const LATEST = Math.max(...Object.keys(CALIBRATIONS).map(Number))

export function calibration(batSide: 'L' | 'R', season?: number | null) {
	const year = season != null && season in CALIBRATIONS ? season : LATEST
	return CALIBRATIONS[year][batSide]
}

/**
 * Crouched in his stance, the top of the batter's helmet stands at this share
 * of his height. Fit against Gameday, where the ABS zone (27% to 53.5% of the
 * batter's height) runs from the hollow of the knee to just above the belt.
 */
export const STANCE_HEIGHT = 0.82

/** The batter's hips from the middle of the plate, ft. */
export const BATTER_OFFSET = 2.5

/** ABS's zone, as shares of the batter's height. */
export const ABS_ZONE = { top: 0.535, bottom: 0.27 }

/** `6' 2"`, as the Stats API writes heights, in feet. */
export function parseHeight(height?: string | null) {
	const m = height?.match(/^\s*(\d+)\s*'\s*(?:(\d+(?:\.\d+)?)\s*"?)?\s*$/)
	if (!m) return null
	const feet = Number(m[1]) + Number(m[2] ?? 0) / 12
	return feet > 0 ? feet : null
}

/**
 * The render's canvas and the batter's body, in feet. The soles stand on the
 * ground (`z = 0`) and the hips `BATTER_OFFSET` off the middle of the plate
 * on the batter's side (catcher's view: righties on the left), so a taller
 * batter gets a taller figure on the same scale as his taller zone.
 */
export function batterPlacement(height: number, batSide: 'L' | 'R', season?: number | null) {
	const c = calibration(batSide, season)
	/** Image px per foot. */
	const px = (c.ground - c.head) / (STANCE_HEIGHT * height)
	const hipX = batSide === 'R' ? -BATTER_OFFSET : BATTER_OFFSET
	const x = (u: number) => hipX + (u - c.hip) / px
	const z = (v: number) => (c.ground - v) / px
	return {
		/** The whole canvas, top left corner and size. */
		canvas: { x: x(0), z: z(0), w: CANVAS.w / px, h: CANVAS.h / px },
		/** What's drawn on it, to keep in view. */
		bounds: { left: x(c.bounds.left), right: x(c.bounds.right), top: z(c.bounds.top) },
		head: z(c.head),
		knee: z(c.knee),
		belt: z(c.belt),
	}
}
