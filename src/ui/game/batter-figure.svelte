<script lang="ts" module>
	/** Visible part of the canvas, as fractions of its size. */
	type Crop = { x: number; y: number; w: number; h: number }

	const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 }

	/** Measured once per uniform + side, so stepping through at-bats doesn't redo it. */
	const crops = new Map<string, Promise<Crop | null>>()

	function loadImage(src: string) {
		return new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image()
			img.crossOrigin = 'anonymous'
			img.onload = () => resolve(img)
			img.onerror = reject
			img.src = src
		})
	}

	/**
	 * The renders share one canvas with lots of transparent padding, so find the
	 * bounding box of the opaque pixels across every layer. `null` when the pixels
	 * can't be read (e.g. no CORS), in which case the whole canvas is shown.
	 */
	async function measureCrop(srcs: string[]): Promise<Crop | null> {
		try {
			const imgs = await Promise.all(srcs.map(loadImage))
			const { naturalWidth, naturalHeight } = imgs[0]
			// A downscaled copy is plenty to find the edges
			const scale = Math.min(1, 256 / Math.max(naturalWidth, naturalHeight))
			const w = Math.max(1, Math.round(naturalWidth * scale))
			const h = Math.max(1, Math.round(naturalHeight * scale))

			const canvas = document.createElement('canvas')
			canvas.width = w
			canvas.height = h
			const ctx = canvas.getContext('2d', { willReadFrequently: true })
			if (!ctx) return null
			for (const img of imgs) ctx.drawImage(img, 0, 0, w, h)
			const { data } = ctx.getImageData(0, 0, w, h)

			let [x0, y0, x1, y1] = [w, h, -1, -1]
			for (let y = 0; y < h; y++) {
				for (let x = 0; x < w; x++) {
					if (data[(y * w + x) * 4 + 3] < 16) continue
					x0 = Math.min(x0, x)
					x1 = Math.max(x1, x)
					y0 = Math.min(y0, y)
					y1 = Math.max(y1, y)
				}
			}
			if (x1 < 0) return null

			return { x: x0 / w, y: y0 / h, w: (x1 + 1 - x0) / w, h: (y1 + 1 - y0) / h }
		} catch {
			return null
		}
	}

	function cropFor(srcs: string[]) {
		const key = srcs.join(' ')
		let crop = crops.get(key)
		if (!crop) {
			crop = measureCrop(srcs)
			crops.set(key, crop)
		}
		return crop
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
		floor,
	}: {
		/** Uniform layers on the same canvas, bottom first. */
		srcs: string[]
		batSide: 'L' | 'R'
		/** Container width, px. */
		width: number
		/** Strike zone edges, px from the container's left. */
		zoneLeft: number
		zoneRight: number
		/** Where the feet go, px from the container's top. */
		floor: number
	} = $props()

	let loaded = $state(0)
	let failed = $state(false)
	let natural = $state<{ w: number; h: number } | null>(null)
	/** `undefined` while measuring. */
	let crop = $state<Crop | null>()

	$effect(() => {
		let cancelled = false
		cropFor(srcs).then((c) => {
			if (!cancelled) crop = c
		})
		return () => {
			cancelled = true
		}
	})

	/**
	 * Fill the height down to the plate, standing just off the zone on the
	 * batter's side (catcher's view: righties on the left). If there isn't room,
	 * tuck in behind the zone a little, then shrink.
	 */
	const figure = $derived.by(() => {
		if (!natural || crop === undefined) return null
		const c = crop ?? FULL
		const aspect = (c.w * natural.w) / (c.h * natural.h)
		const overlap = (zoneRight - zoneLeft) / 3
		const room = batSide === 'R' ? zoneLeft + overlap : width - zoneRight + overlap
		const h = Math.max(0, Math.min(floor, room / aspect))
		const w = h * aspect
		const left = batSide === 'R' ? Math.max(0, zoneLeft - w) : Math.min(width - w, zoneRight)
		return { c, left, top: floor - h, w, h }
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
