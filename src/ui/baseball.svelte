<script lang="ts">
	// @reference https://alexharri.com/blog/ascii-rendering

	import {
		advance,
		IDLE_SPIN,
		LEATHER,
		length,
		lightingAt,
		quatFromRotation,
		quatMul,
		quatNormalize,
		randomOrientation,
		releaseSpin,
		rotationBetween,
		rotationMatrix,
		scale,
		seamStyle,
		shade,
		sphereAt,
		surfaceAt,
		THREAD,
		type Quat,
		type RotationSample,
		type Vec3,
	} from '#lib/baseball.js'
	import { colorSchemeStore } from '#ui/store.svelte.js'
	import type { HTMLAttributes } from 'svelte/elements'

	let { ...props }: HTMLAttributes<HTMLElement> = $props()

	/** Caps the grid so huge containers stay cheap to render. */
	const MAX_COLS = 120
	/** Fraction of the grid's shorter side the ball spans. */
	const FILL = 0.94
	/** Sub-cell samples, matching where each glyph's shape is sampled below. */
	const SUBSAMPLES: [number, number][] = [
		[0.25, 0.17],
		[0.75, 0.17],
		[0.25, 0.5],
		[0.75, 0.5],
		[0.25, 0.83],
		[0.75, 0.83],
	]
	/** Most orientations blended per frame for motion blur. */
	const MAX_BLUR_STEPS = 5

	let pre = $state<HTMLPreElement>()
	let probe = $state<HTMLSpanElement>()
	let width = $state(0)
	let height = $state(0)
	let cell = $state({ width: 0, height: 0 })

	const isDark = $derived(colorSchemeStore.mode !== 'light')
	const cols = $derived(cell.width ? Math.min(MAX_COLS, Math.floor(width / cell.width)) : 0)
	const rows = $derived(cell.height ? Math.floor(height / cell.height) : 0)
	/** Ball radius in pixels; cells aren't square, so this keeps it round. */
	const radius = $derived((Math.min(cols * cell.width, rows * cell.height) / 2) * FILL)
	const style = $derived(seamStyle(Math.max(cell.width, cell.height) / radius))

	/** Per-sample world-space normals and lighting, fixed until the grid changes. */
	const samples = $derived.by(() => {
		const count = cols * rows * SUBSAMPLES.length
		const normals = new Float32Array(count * 3)
		const diffuse = new Float32Array(count)
		const specular = new Float32Array(count)
		const inside = new Uint8Array(count)

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				SUBSAMPLES.forEach(([sx, sy], k) => {
					const i = (row * cols + col) * SUBSAMPLES.length + k
					const x = ((col + sx - cols / 2) * cell.width) / radius
					const y = ((rows / 2 - row - sy) * cell.height) / radius
					const r2 = x * x + y * y
					if (r2 > 1) return
					const n: Vec3 = [x, y, Math.sqrt(1 - r2)]
					const light = lightingAt(n)
					normals.set(n, i * 3)
					diffuse[i] = light.diffuse
					specular[i] = light.specular
					inside[i] = 1
				})
			}
		}

		return { normals, diffuse, specular, inside }
	})

	let orientation: Quat = randomOrientation()
	/** Angular velocity in world space (rad/s). */
	let spin: Vec3 = scale(sphereAt(Math.random() * 2 - 1, Math.random() * 2 - 1), IDLE_SPIN)
	let idle = IDLE_SPIN

	let frame = $state.raw<{ text: string; stitch: boolean }[]>([])
	let dirty = true

	// --- Glyphs ---

	let glyphs: { char: string; shape: number[] }[] = []
	let glyphCache = new Map<number, string>()

	/** How much of each sample region every glyph covers, scaled so the densest region is 1. */
	function measureGlyphs(aspect: number) {
		const chars = " .`'^,:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
		const w = 12
		const h = Math.round(w / aspect)
		const canvas = document.createElement('canvas')
		canvas.width = w
		canvas.height = h
		const ctx = canvas.getContext('2d', { willReadFrequently: true })!
		ctx.font = `${h}px "Geist Mono", monospace`
		ctx.textBaseline = 'top'
		ctx.fillStyle = 'white'
		const r = 3

		const measured = [...chars].map((char) => {
			ctx.clearRect(0, 0, w, h)
			ctx.fillText(char, (w - ctx.measureText(char).width) / 2, 0)
			const { data } = ctx.getImageData(0, 0, w, h)
			const shape = SUBSAMPLES.map(([sx, sy]) => {
				const cx = Math.floor(sx * w)
				const cy = Math.floor(sy * h)
				let sum = 0,
					count = 0
				for (let dy = -r; dy <= r; dy++) {
					for (let dx = -r; dx <= r; dx++) {
						const px = cx + dx,
							py = cy + dy
						if (dx * dx + dy * dy > r * r || px < 0 || px >= w || py < 0 || py >= h) continue
						sum += data[(py * w + px) * 4 + 3]
						count++
					}
				}
				return sum / count / 255
			})
			return { char, shape }
		})

		const max = Math.max(...measured.flatMap((g) => g.shape))
		glyphs = measured.map(({ char, shape }) => ({ char, shape: shape.map((v) => v / max) }))
		glyphCache = new Map()
		dirty = true
	}

	/** Glyph whose shape best matches a cell's sampled ink, sharpened a little at edges. */
	function glyphFor(ink: number[]) {
		let key = 0
		for (const v of ink) key = key * 32 + Math.round(Math.min(1, Math.max(0, v)) * 31)
		const cached = glyphCache.get(key)
		if (cached !== undefined) return cached

		const max = Math.max(...ink)
		let best = ' '
		if (max > 0.02) {
			const sharpened = ink.map((v) => Math.pow(v / max, 1.3) * max)
			let bestDist = Infinity
			for (const { char, shape } of glyphs) {
				let dist = 0
				for (let i = 0; i < shape.length; i++) dist += (sharpened[i] - shape[i]) ** 2
				if (dist < bestDist) {
					bestDist = dist
					best = char
				}
			}
		}

		glyphCache.set(key, best)
		return best
	}

	// --- Rendering ---

	/** Renders the ball, blending orientations across `blur` (the rotation during the exposure). */
	function render(blur: Vec3) {
		if (!glyphs.length || !cols || !rows) return

		const blurAngle = length(blur)
		const steps = Math.min(
			MAX_BLUR_STEPS,
			Math.max(1, Math.ceil(blurAngle / ((0.5 * cell.width) / radius))),
		)
		const matrices = Array.from({ length: steps }, (_, k) =>
			rotationMatrix(quatMul(quatFromRotation(scale(blur, (k + 1) / steps - 1)), orientation)),
		)

		const { normals, diffuse, specular, inside } = samples
		const light = { diffuse: 0, specular: 0 }
		const ink = new Array<number>(SUBSAMPLES.length)
		const thread = new Array<number>(SUBSAMPLES.length)
		const segments: { text: string; stitch: boolean }[] = []
		let text = ''
		let stitch = false

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				let threads = 0
				for (let k = 0; k < SUBSAMPLES.length; k++) {
					const i = (row * cols + col) * SUBSAMPLES.length + k
					ink[k] = thread[k] = 0
					if (!inside[i]) continue
					const nx = normals[i * 3],
						ny = normals[i * 3 + 1],
						nz = normals[i * 3 + 2]
					light.diffuse = diffuse[i]
					light.specular = specular[i]

					let brightness = 0
					for (const m of matrices) {
						// World → ball-local is the transpose of the orientation matrix
						const surface = surfaceAt(
							m[0] * nx + m[3] * ny + m[6] * nz,
							m[1] * nx + m[4] * ny + m[7] * nz,
							m[2] * nx + m[5] * ny + m[8] * nz,
							style,
						)
						// Count thread here; shade it as leather unless enough of the cell is stitched
						if (surface === THREAD) thread[k]++
						else brightness += shade(surface, light)
					}
					brightness = (brightness + thread[k] * shade(LEATHER, light)) / steps
					thread[k] /= steps
					threads += thread[k]

					// Light text on dark draws light as ink; dark text on light draws shadow as ink,
					// with a floor so the lit side of a white ball doesn't vanish into the page
					ink[k] = isDark ? brightness : 0.1 + 0.8 * (1 - brightness)
				}

				// Stitched cells draw just the thread, in red, so its shape picks the glyph. Red thread
				// is darker than leather, so on a light page it stays inky even in shadow
				const isStitch = threads / SUBSAMPLES.length > 0.12
				if (isStitch) {
					for (let k = 0; k < SUBSAMPLES.length; k++) {
						const lit = Math.min(1, diffuse[(row * cols + col) * SUBSAMPLES.length + k])
						ink[k] = thread[k] * (isDark ? 0.3 + 0.45 * lit : 0.55 + 0.25 * (1 - lit))
					}
				}
				if (isStitch !== stitch && text) {
					segments.push({ text, stitch })
					text = ''
				}
				stitch = isStitch
				text += glyphFor(ink)
			}
			if (row < rows - 1) text += '\n'
		}
		if (text) segments.push({ text, stitch })

		frame = segments
	}

	// --- Lifecycle ---

	function measureCell() {
		if (!probe) return
		const rect = probe.getBoundingClientRect()
		if (!rect.width || !rect.height) return
		const next = { width: rect.width / 10, height: rect.height / 2 }
		if (next.width === cell.width && next.height === cell.height) return
		cell = next
		document.fonts.load(`${next.height}px "Geist Mono"`).then(() => {
			measureGlyphs(next.width / next.height)
		})
	}

	$effect(() => {
		if (!probe) return
		// Font loads and font-size changes both resize the probe
		const observer = new ResizeObserver(measureCell)
		observer.observe(probe)
		return () => observer.disconnect()
	})

	$effect(() => {
		samples
		style
		isDark
		dirty = true
	})

	$effect(() => {
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
		const update = () => {
			idle = motion.matches ? 0 : IDLE_SPIN
			if (motion.matches) spin = [0, 0, 0]
		}
		update()
		motion.addEventListener('change', update)
		return () => motion.removeEventListener('change', update)
	})

	let visible = true

	$effect(() => {
		if (!pre) return
		const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
		observer.observe(pre)
		return () => observer.disconnect()
	})

	$effect(() => {
		let raf = 0
		let last = 0

		function tick(time: number) {
			raf = requestAnimationFrame(tick)
			// Big gaps (background tabs, offscreen) resume smoothly instead of lurching
			const dt = last ? Math.min(0.05, (time - last) / 1000) : 0
			last = time
			if (!visible) return

			let blur: Vec3 = [0, 0, 0]
			if (!dragging && length(spin) > 1e-6) {
				const before = spin
				;({ orientation, spin } = advance(orientation, spin, dt, idle))
				if (length(spin) < 1e-3) spin = [0, 0, 0]
				// Exposure of one frame, like a camera with a 360° shutter
				blur = scale(before, dt)
				dirty = true
			}

			if (!dirty) return
			dirty = false
			render(blur)
		}

		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	})

	// --- Pointer interaction ---

	let dragging = false
	let pointerId = -1
	let grabbed: Vec3 = [0, 0, 1]
	let history: RotationSample[] = []

	/** Point on the ball (world space) under the pointer. */
	function pointOnBall(e: PointerEvent) {
		const rect = pre!.getBoundingClientRect()
		return sphereAt(
			(e.clientX - rect.left - rect.width / 2) / radius,
			(rect.top + rect.height / 2 - e.clientY) / radius,
		)
	}

	function onpointerdown(e: PointerEvent) {
		if (pointerId !== -1 || !radius) return
		pointerId = e.pointerId
		dragging = true
		grabbed = pointOnBall(e)
		history = []
		spin = [0, 0, 0]
		;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
	}

	function onpointermove(e: PointerEvent) {
		if (e.pointerId !== pointerId) return
		// Roll the ball so the leather under the pointer stays under it
		const point = pointOnBall(e)
		const rotation = rotationBetween(grabbed, point)
		grabbed = point
		orientation = quatNormalize(quatMul(quatFromRotation(rotation), orientation))
		const now = performance.now()
		history = [...history.filter((s) => now - s.time < 250), { time: now, rotation }]
		dirty = true
	}

	function onpointerup(e: PointerEvent) {
		if (e.pointerId !== pointerId) return
		pointerId = -1
		dragging = false
		// Let go and it keeps the spin the drag gave it
		spin = releaseSpin(history, performance.now())
	}
</script>

<figure {...props}>
	<pre
		bind:this={pre}
		bind:clientWidth={width}
		bind:clientHeight={height}
		class="relative grid aspect-square cursor-grab touch-none place-content-center font-mono leading-none tracking-tighter select-none active:cursor-grabbing"
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		onpointercancel={onpointerup}
		role="img"
		aria-label="Interactive 3D baseball rendered in ASCII art"><span
			bind:this={probe}
			class="invisible absolute top-0 left-0"
			aria-hidden="true">{'0000000000\n0'}</span
		><span
			>{#each frame as { text, stitch }, i (i)}{#if stitch}<span
						class="text-red-700 dark:text-red-400">{text}</span
					>{:else}{text}{/if}{/each}</span
		></pre>
</figure>
