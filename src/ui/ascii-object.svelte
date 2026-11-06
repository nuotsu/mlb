<script lang="ts">
	// @reference https://alexharri.com/blog/ascii-rendering

	import {
		advance,
		blurMatrices,
		IDLE_SPIN,
		length,
		quatFromRotation,
		quatMul,
		quatNormalize,
		releaseSpin,
		renderFrame,
		rotationBetween,
		scale,
		sphereAt,
		SUBSAMPLES,
		type Quat,
		type RotationSample,
		type Shape,
		type Vec3,
	} from '#lib/ascii-3d.js'
	import { BASEBALL } from '#lib/baseball.js'
	import { colorSchemeStore } from '#ui/store.svelte.js'
	import type { Attachment } from 'svelte/attachments'
	import type { HTMLAttributes } from 'svelte/elements'

	let { shape = BASEBALL, ...props }: { shape?: Shape } & HTMLAttributes<HTMLElement> = $props()

	/** Caps the grid so huge containers stay cheap to render. */
	const MAX_COLS = 120
	/** Fraction of the grid's shorter side the object's bounding sphere spans. */
	const FILL = 0.94
	/** Longest a frame spends on a shape's one-time setup before trying again next frame. */
	const PREPARE_MS = 6

	let width = $state(0)
	let height = $state(0)
	let cell = $state({ width: 0, height: 0 })

	const isDark = $derived(colorSchemeStore.mode !== 'light')
	const cols = $derived(cell.width ? Math.min(MAX_COLS, Math.floor(width / cell.width)) : 0)
	const rows = $derived(cell.height ? Math.floor(height / cell.height) : 0)
	/** Bounding-sphere radius in pixels; cells aren't square, so this keeps it round. */
	const radius = $derived((Math.min(cols * cell.width, rows * cell.height) / 2) * FILL)

	/** The shape being shown: it takes over from `shape` on the next frame, with a fresh spin. */
	let current: Shape | undefined
	let orientation: Quat = [1, 0, 0, 0]
	/** Angular velocity in world space (rad/s). */
	let spin: Vec3 = [0, 0, 0]
	let idle = IDLE_SPIN

	let frame = $state.raw<{ text: string; stitch: boolean }[]>([])
	let dirty = true

	function sync() {
		if (current === shape) return
		current = shape
		;({ orientation, spin } = shape.start())
		if (!idle) spin = [0, 0, 0]
		dirty = true
	}

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
	function glyphFor(ink: ArrayLike<number>) {
		let key = 0
		for (let i = 0; i < ink.length; i++)
			key = key * 32 + Math.round(Math.min(1, Math.max(0, ink[i])) * 31)
		const cached = glyphCache.get(key)
		if (cached !== undefined) return cached

		const max = Math.max(...Array.from(ink))
		let best = ' '
		if (max > 0.02) {
			const sharpened = Array.from(ink, (v) => Math.pow(v / max, 1.3) * max)
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

	/** Renders the shape, blending orientations across `blur` (the rotation during the exposure). */
	function render(shown: Shape, blur: Vec3) {
		const grid = { cols, rows, cellWidth: cell.width / radius, cellHeight: cell.height / radius }
		const matrices = blurMatrices(orientation, blur, grid.cellWidth, shown.blurSteps)
		const { ink, stitch } = renderFrame(shown, grid, matrices, isDark)

		const n = SUBSAMPLES.length
		const segments: { text: string; stitch: boolean }[] = []
		let text = ''
		let stitched = false

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const i = row * cols + col
				// Stitched cells draw just the thread, in red
				const isStitch = stitch[i] === 1
				if (isStitch !== stitched && text) {
					segments.push({ text, stitch: stitched })
					text = ''
				}
				stitched = isStitch
				text += glyphFor(ink.subarray(i * n, i * n + n))
			}
			if (row < rows - 1) text += '\n'
		}
		if (text) segments.push({ text, stitch: stitched })

		frame = segments
	}

	// --- Lifecycle ---

	function measureCell(probe: HTMLElement) {
		const rect = probe.getBoundingClientRect()
		if (!rect.width || !rect.height) return
		const next = { width: rect.width / 10, height: rect.height / 2 }
		if (next.width === cell.width && next.height === cell.height) return
		cell = next
		document.fonts.load(`${next.height}px "Geist Mono"`).then(() => {
			measureGlyphs(next.width / next.height)
		})
	}

	/** Font loads and font-size changes both resize the probe. */
	const watchCell: Attachment<HTMLElement> = (probe) => {
		const observer = new ResizeObserver(() => measureCell(probe))
		observer.observe(probe)
		return () => observer.disconnect()
	}

	$effect(() => {
		radius
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

	/** Pauses rendering while offscreen. */
	const watchVisibility: Attachment<HTMLElement> = (node) => {
		const observer = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
		observer.observe(node)
		return () => observer.disconnect()
	}

	$effect(() => {
		let raf = 0
		let last = 0

		function tick(time: number) {
			raf = requestAnimationFrame(tick)
			// Big gaps (background tabs, offscreen) resume smoothly instead of lurching
			const dt = last ? Math.min(0.05, (time - last) / 1000) : 0
			last = time
			if (!visible) return
			sync()

			let blur: Vec3 = [0, 0, 0]
			if (!dragging && length(spin) > 1e-6) {
				const before = spin
				;({ orientation, spin } = advance(orientation, spin, dt, idle))
				if (length(spin) < 1e-3) spin = [0, 0, 0]
				// Exposure of one frame, like a camera with a 360° shutter
				blur = scale(before, dt)
				dirty = true
			}

			if (!dirty || !current || !glyphs.length || !cols || !rows || !radius) return
			// Some shapes need setup too slow for one frame; spread it out before the first render
			if (current.prepare && !current.prepare(performance.now() + PREPARE_MS)) return
			dirty = false
			render(current, blur)
		}

		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	})

	// --- Pointer interaction ---

	let dragging = false
	let pointerId = -1
	let grabbed: Vec3 = [0, 0, 1]
	let history: RotationSample[] = []

	/** Point on the bounding sphere (world space) under the pointer. */
	function pointOnSphere(e: PointerEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
		return sphereAt(
			(e.clientX - rect.left - rect.width / 2) / radius,
			(rect.top + rect.height / 2 - e.clientY) / radius,
		)
	}

	function onpointerdown(e: PointerEvent) {
		if (pointerId !== -1 || !radius) return
		sync()
		pointerId = e.pointerId
		dragging = true
		grabbed = pointOnSphere(e)
		history = []
		spin = [0, 0, 0]
		;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
	}

	function onpointermove(e: PointerEvent) {
		if (e.pointerId !== pointerId) return
		// Roll the object so the point under the pointer stays under it
		const point = pointOnSphere(e)
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
		{@attach watchVisibility}
		bind:clientWidth={width}
		bind:clientHeight={height}
		class="relative grid aspect-square cursor-grab touch-none place-content-center font-mono leading-none tracking-tighter select-none [overflow-anchor:none] active:cursor-grabbing"
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		onpointercancel={onpointerup}
		role="img"
		aria-label="Interactive 3D {shape.name} rendered in ASCII art"><span
			{@attach watchCell}
			class="invisible absolute top-0 left-0"
			aria-hidden="true">{'0000000000\n0'}</span
		><span
			>{#each frame as { text, stitch }, i (i)}{#if stitch}<span
						class="text-red-700 dark:text-red-400">{text}</span
					>{:else}{text}{/if}{/each}</span
		></pre>
</figure>
