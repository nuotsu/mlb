<svelte:options namespace="svg" />

<script lang="ts">
	let {
		srcs,
		x,
		y,
		width,
		height,
		onerror,
	}: {
		/** Uniform layers on the same canvas, bottom first. */
		srcs: string[]
		/** Where the whole canvas goes, in the parent SVG's units. */
		x: number
		y: number
		width: number
		height: number
		/** A layer couldn't load, so the figure isn't shown. */
		onerror?: () => void
	} = $props()

	let ready = $state(false)

	function load(src: string) {
		return new Promise<void>((resolve, reject) => {
			const img = new Image()
			img.onload = () => resolve()
			img.onerror = reject
			img.src = src
		})
	}

	/**
	 * Waits on every layer before showing any, so a jersey never floats without
	 * its pants. Loaded apart from the `<image>`s, which may finish before
	 * hydration and miss their `load` events; they draw from the cache.
	 */
	$effect(() => {
		let cancelled = false
		Promise.all(srcs.map(load)).then(
			() => {
				if (!cancelled) ready = true
			},
			() => {
				if (!cancelled) onerror?.()
			},
		)
		return () => {
			cancelled = true
		}
	})
</script>

<g
	class="pointer-events-none transition-opacity duration-300"
	opacity={ready ? 1 : 0}
	aria-hidden="true"
>
	{#each srcs as src (src)}
		<image href={src} {x} {y} {width} {height} preserveAspectRatio="none" />
	{/each}
</g>
