<svelte:options namespace="svg" />

<script lang="ts" module>
	import type { SpinAxis } from '#lib/pitch-flight.js'

	type Vec = { x: number; y: number; z: number }

	/**
	 * A baseball's seam on the unit sphere: a wobbly equator that dips twice
	 * and rises twice, which splits the cover into the two figure-eight pieces.
	 */
	const SEAM: Vec[] = Array.from({ length: 96 }, (_, i) => {
		const t = (i / 96) * Math.PI * 2
		const s = 0.27
		return {
			x: (1 - s) * Math.cos(t) + s * Math.cos(3 * t),
			y: (1 - s) * Math.sin(t) - s * Math.sin(3 * t),
			z: 2 * Math.sqrt(s * (1 - s)) * Math.sin(2 * t),
		}
	})

	/**
	 * Axes of the seam model that the seam crosses four times per turn (a
	 * four-seam grip) or twice (two-seamers and sinkers).
	 */
	const FOUR_SEAM_AXIS: Vec = { x: 0, y: 0, z: 1 }
	const TWO_SEAM_AXIS: Vec = { x: Math.SQRT1_2, y: Math.SQRT1_2, z: 0 }

	const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z
	const cross = (a: Vec, b: Vec): Vec => ({
		x: a.y * b.z - a.z * b.y,
		y: a.z * b.x - a.x * b.z,
		z: a.x * b.y - a.y * b.x,
	})

	/** Rodrigues' rotation of `p` about unit axis `k` by `angle` (right-hand rule). */
	function rotate(p: Vec, k: Vec, angle: number): Vec {
		const cos = Math.cos(angle)
		const sin = Math.sin(angle)
		const kxp = cross(k, p)
		const kdp = dot(k, p) * (1 - cos)
		return {
			x: p.x * cos + kxp.x * sin + k.x * kdp,
			y: p.y * cos + kxp.y * sin + k.y * kdp,
			z: p.z * cos + kxp.z * sin + k.z * kdp,
		}
	}

	/** The seam turned so its spin axis lines up with the pitch's. */
	function alignSeam(axis: SpinAxis, seamAxis: Vec): Vec[] {
		const k = cross(seamAxis, axis)
		const len = Math.hypot(k.x, k.y, k.z)
		const angle = Math.acos(Math.max(-1, Math.min(1, dot(seamAxis, axis))))
		if (len < 1e-6) {
			if (angle < 1) return SEAM
			// Opposite: half a turn about any axis square to it
			const flip = Math.abs(seamAxis.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 }
			return SEAM.map((p) => rotate(p, flip, Math.PI))
		}
		const unit = { x: k.x / len, y: k.y / len, z: k.z / len }
		return SEAM.map((p) => rotate(p, unit, angle))
	}

	/**
	 * The near half of the seam as SVG path data, seen from the catcher
	 * (looking toward +y, so the visible side faces −y).
	 */
	function seamPath(seam: Vec[], axis: SpinAxis, angle: number, cx: number, cy: number, r: number) {
		let d = ''
		let drawing = false
		for (let i = 0; i <= seam.length; i++) {
			const p = rotate(seam[i % seam.length], axis, angle)
			if (p.y > 0.05) {
				drawing = false
				continue
			}
			const x = (cx + p.x * r).toFixed(2)
			const y = (cy - p.z * r).toFixed(2)
			d += `${drawing ? 'L' : 'M'}${x},${y}`
			drawing = true
		}
		return d
	}
</script>

<script lang="ts">
	import { visibleSpinRevsPerSecond } from '#lib/pitch-flight.js'

	let {
		x,
		y,
		r,
		axis,
		spinRate,
		twoSeam = false,
		color,
		path,
		animate = true,
	}: {
		/** Where the ball rests: the plate location, SVG units. */
		x: number
		y: number
		r: number
		axis: SpinAxis
		spinRate: number
		/** Sinkers and two-seamers show two seams per turn instead of four. */
		twoSeam?: boolean
		/** Outline, to keep the pitch result's color. */
		color: string
		/** Release → plate, in SVG units. `scale` shrinks the ball with distance. */
		path?: { x: number; y: number; scale: number; t: number }[] | null
		/** `false` for a still ball (e.g. reduced motion). */
		animate?: boolean
	} = $props()

	const id = $props.id()

	/** Stretch the flight so it can be followed (≈0.4 s → ≈1.4 s). */
	const SLOW_MOTION = 3.5

	const seam = $derived(alignSeam(axis, twoSeam ? TWO_SEAM_AXIS : FOUR_SEAM_AXIS))

	let angle = $state(0.6)
	let pos = $state<{ x: number; y: number; r: number } | null>(null)

	$effect(() => {
		if (!animate) {
			pos = null
			return
		}

		const revsPerMs = visibleSpinRevsPerSecond(spinRate) / 1000
		const flight = path && path.length > 1 ? path : null
		const duration = flight ? flight[flight.length - 1].t * SLOW_MOTION * 1000 : 0
		let start: number | null = null
		let frame = requestAnimationFrame(function tick(now) {
			start ??= now
			const elapsed = now - start
			angle = 0.6 + elapsed * revsPerMs * Math.PI * 2

			if (flight && elapsed < duration) {
				const t = elapsed / SLOW_MOTION / 1000
				let i = 1
				while (i < flight.length - 1 && flight[i].t < t) i++
				const a = flight[i - 1]
				const b = flight[i]
				const f = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1)))
				pos = {
					x: a.x + (b.x - a.x) * f,
					y: a.y + (b.y - a.y) * f,
					r: Math.max(1.5, r * (a.scale + (b.scale - a.scale) * f)),
				}
			} else {
				pos = null
			}

			frame = requestAnimationFrame(tick)
		})

		return () => cancelAnimationFrame(frame)
	})

	const cx = $derived(pos?.x ?? x)
	const cy = $derived(pos?.y ?? y)
	const cr = $derived(pos?.r ?? r)
	const d = $derived(seamPath(seam, axis, angle, cx, cy, cr))
</script>

<defs>
	<radialGradient id="{id}-shade" cx="0.4" cy="0.35" r="0.75">
		<stop offset="0" stop-color="#fff" />
		<stop offset="0.7" stop-color="#f1efe9" />
		<stop offset="1" stop-color="#c9c5bb" />
	</radialGradient>
</defs>

<!-- Holds the hover in place while the ball is in flight -->
<circle cx={x} cy={y} {r} fill="transparent" />

<g class="pointer-events-none">
	<circle
		{cx}
		{cy}
		r={cr}
		fill="url(#{id}-shade)"
		stroke={color}
		stroke-width={cr > 4 ? 1.5 : 0.75}
	/>
	{#if cr > 3}
		<path
			{d}
			fill="none"
			stroke="#d42a2a"
			stroke-width={cr * 0.14}
			stroke-dasharray="{cr * 0.12} {cr * 0.1}"
			stroke-linecap="round"
		/>
	{/if}
</g>
