<script lang="ts" module>
	/** Visible part of the canvas, as fractions of its size. */
	type Crop = { x: number; y: number; w: number; h: number }

	/**
	 * The rulebook's strike zone landmarks, as fractions of the canvas height
	 * from the top: the top of the shoulders, the top of the uniform pants, and
	 * the bottom of the figure where the feet meet the ground.
	 */
	type Landmarks = { shoulders: number; pantsTop: number; feet: number }

	type Measure = { crop: Crop; landmarks: Landmarks | null }

	const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 }

	/** Measured once per uniform + side, so stepping through at-bats doesn't redo it. */
	const measures = new Map<string, Promise<Measure | null>>()

	function loadImage(src: string) {
		return new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image()
			img.crossOrigin = 'anonymous'
			img.onload = () => resolve(img)
			img.onerror = reject
			img.src = src
		})
	}

	/** Opaque pixels of one layer. */
	type Mask = { w: number; h: number; at: (x: number, y: number) => boolean }

	function bounds({ w, h, at }: Mask) {
		let [x0, y0, x1, y1] = [w, h, -1, -1]
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				if (!at(x, y)) continue
				x0 = Math.min(x0, x)
				x1 = Math.max(x1, x)
				y0 = Math.min(y0, y)
				y1 = Math.max(y1, y)
			}
		}
		return x1 < 0 ? null : { x0, y0, x1, y1 }
	}

	/**
	 * The top of the pants is the top of the pants layer. The shoulders are the
	 * jersey's top edge over the middle of the waist, which skips arms raised
	 * into the stance; the median shrugs off a stray collar or sleeve pixel.
	 */
	function findLandmarks(pants: Mask, jersey: Mask, h: number): Landmarks | null {
		const p = bounds(pants)
		if (!p) return null

		const row = p.y0 + Math.round((p.y1 - p.y0) * 0.03)
		let [a, b] = [pants.w, -1]
		for (let x = 0; x < pants.w; x++) {
			if (!pants.at(x, row)) continue
			a = Math.min(a, x)
			b = Math.max(b, x)
		}
		if (b < a) return null

		const tops: number[] = []
		const inset = (b - a) / 4
		for (let x = Math.round(a + inset); x <= b - inset; x++) {
			for (let y = 0; y < p.y0; y++) {
				if (jersey.at(x, y)) {
					tops.push(y)
					break
				}
			}
		}
		if (!tops.length) return null
		tops.sort((m, n) => m - n)
		const shoulders = tops[Math.floor(tops.length / 2)]

		return { shoulders: shoulders / h, pantsTop: p.y0 / h, feet: (p.y1 + 1) / h }
	}

	/**
	 * The renders share one canvas with lots of transparent padding, so find the
	 * bounding box of the opaque pixels across every layer, and the strike zone
	 * landmarks from the pants (bottom layer) and jersey (top layer). `null` when
	 * the pixels can't be read (e.g. no CORS), in which case the whole canvas is
	 * shown.
	 */
	async function measure(srcs: string[]): Promise<Measure | null> {
		try {
			const imgs = await Promise.all(srcs.map(loadImage))
			const { naturalWidth, naturalHeight } = imgs[0]
			// A downscaled copy is plenty to find the edges
			const scale = Math.min(1, 512 / Math.max(naturalWidth, naturalHeight))
			const w = Math.max(1, Math.round(naturalWidth * scale))
			const h = Math.max(1, Math.round(naturalHeight * scale))

			const canvas = document.createElement('canvas')
			canvas.width = w
			canvas.height = h
			const ctx = canvas.getContext('2d', { willReadFrequently: true })
			if (!ctx) return null

			const masks: Mask[] = imgs.map((img) => {
				ctx.clearRect(0, 0, w, h)
				ctx.drawImage(img, 0, 0, w, h)
				const { data } = ctx.getImageData(0, 0, w, h)
				return { w, h, at: (x, y) => data[(y * w + x) * 4 + 3] >= 16 }
			})

			const all = bounds({ w, h, at: (x, y) => masks.some((m) => m.at(x, y)) })
			if (!all) return null

			return {
				crop: {
					x: all.x0 / w,
					y: all.y0 / h,
					w: (all.x1 + 1 - all.x0) / w,
					h: (all.y1 + 1 - all.y0) / h,
				},
				landmarks: masks.length > 1 ? findLandmarks(masks[0], masks.at(-1)!, h) : null,
			}
		} catch {
			return null
		}
	}

	function measureFor(srcs: string[]) {
		const key = srcs.join(' ')
		let m = measures.get(key)
		if (!m) {
			m = measure(srcs)
			measures.set(key, m)
		}
		return m
	}
</script>

<script lang="ts">
	import { cn } from '#lib/utils.js'

	let {
		srcs,
		batSide,
		width,
		zoneLeft,
		zoneRight,
		gap = 0,
		floor,
		zoneTop,
		ground,
		onmeasure,
	}: {
		/** Uniform layers on the same canvas, bottom first. */
		srcs: string[]
		batSide: 'L' | 'R'
		/** Container width, px. */
		width: number
		/** Strike zone edges, px from the container's left. */
		zoneLeft: number
		zoneRight: number
		/** Room between the zone and the batter when there's space for it, px. */
		gap?: number
		/** Where the feet go when the figure can't be measured, px from the container's top. */
		floor: number
		/** Statcast's top of the zone and the ground, at the batter's depth, px from the top. */
		zoneTop?: number
		ground?: number
		/** The width the figure takes when it has room, px; `0` when it can't be shown. */
		onmeasure?: (width: number) => void
	} = $props()

	let loaded = $state(0)
	let failed = $state(false)
	let natural = $state<{ w: number; h: number } | null>(null)
	/** `undefined` while measuring. */
	let measured = $state<Measure | null>()

	$effect(() => {
		let cancelled = false
		measureFor(srcs).then((m) => {
			if (!cancelled) measured = m
		})
		return () => {
			cancelled = true
		}
	})

	/**
	 * True to scale when the landmarks can be measured: the rulebook's top of
	 * the zone (midway between the shoulders and the top of the pants) sits on
	 * Statcast's `strikeZoneTop` and the feet on the ground, so the bottom of
	 * the zone lands at the knees on its own. The figure may run past the top
	 * of the box.
	 *
	 * Otherwise, fill the height down to the plate and shrink to fit.
	 *
	 * Either way it stands `gap` off the zone on the batter's side (catcher's
	 * view: righties on the left), giving up the gap and then tucking in behind
	 * the zone a little if there isn't room.
	 */
	const figure = $derived.by(() => {
		if (!natural || measured === undefined) return null
		const c = measured?.crop ?? FULL
		const landmarks = measured?.landmarks
		const overlap = (zoneRight - zoneLeft) / 3

		const aspect = (c.w * natural.w) / (c.h * natural.h)

		let canvasH: number
		let canvasTop: number
		/** Width with room to spare, for the parent to make room. */
		let wanted: number
		const mid = landmarks && (landmarks.shoulders + landmarks.pantsTop) / 2
		if (landmarks && mid != null && zoneTop != null && ground != null && ground > zoneTop) {
			canvasH = (ground - zoneTop) / (landmarks.feet - mid)
			canvasTop = ground - landmarks.feet * canvasH
			wanted = c.h * canvasH * aspect
		} else {
			const room = batSide === 'R' ? zoneLeft + overlap : width - zoneRight + overlap
			const h = Math.max(0, Math.min(floor, room / aspect))
			canvasH = h / c.h
			canvasTop = floor - h - c.y * canvasH
			wanted = Math.max(0, floor) * aspect
		}

		const canvasW = (canvasH * natural.w) / natural.h
		const w = c.w * canvasW
		const h = c.h * canvasH
		const left =
			batSide === 'R'
				? zoneLeft - w >= 0
					? Math.max(0, zoneLeft - gap - w)
					: Math.min(0, zoneLeft + overlap - w)
				: zoneRight + w <= width
					? Math.min(width - w, zoneRight + gap)
					: Math.max(width - w, zoneRight - overlap)
		return { c, left, top: canvasTop + c.y * canvasH, w, h, wanted }
	})

	$effect(() => {
		if (failed) onmeasure?.(0)
		else if (figure) onmeasure?.(figure.wanted)
	})

	const visible = $derived(loaded === srcs.length && figure != null)
</script>

{#if !failed}
	<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
		<div
			class={cn(
				'absolute overflow-hidden transition-opacity duration-300',
				!visible && 'opacity-0',
			)}
			style:left="{figure?.left ?? 0}px"
			style:top="{figure?.top ?? 0}px"
			style:width="{figure?.w ?? 0}px"
			style:height="{figure?.h ?? 0}px"
		>
			{#each srcs as src (src)}
				{@const c = figure?.c ?? FULL}
				<img
					class="absolute max-w-none"
					style:left="{(-c.x / c.w) * 100}%"
					style:top="{(-c.y / c.h) * 100}%"
					style:width="{100 / c.w}%"
					style:height="{100 / c.h}%"
					{src}
					alt=""
					draggable="false"
					onload={(e) => {
						const img = e.currentTarget as HTMLImageElement
						natural ??= { w: img.naturalWidth, h: img.naturalHeight }
						loaded++
					}}
					onerror={() => (failed = true)}
				/>
			{/each}
		</div>
	</div>
{/if}
