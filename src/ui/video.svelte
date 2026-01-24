<script lang="ts">
	import Hls from 'hls.js'
	import type { HTMLVideoAttributes } from 'svelte/elements'

	let {
		playbacks,
		poster,
		class: className,
		...props
	}: {
		playbacks?: MLB.ContentItemPlayback[]
		poster?: string
		class?: string
	} & HTMLVideoAttributes = $props()

	let video = $state<HTMLVideoElement>()

	const hls = $derived(playbacks?.find((p) => p.name === 'hlsCloud')?.url)
	const mp4 = $derived(playbacks?.find((p) => p.name === 'mp4Avc')?.url)

	$effect(() => {
		const el = video
		if (!el) return

		if (hls) {
			if (el.canPlayType('application/vnd.apple.mpegurl')) {
				// Native HLS (Safari, iOS)
				el.src = hls
			} else if (Hls.isSupported()) {
				// hls.js (Chrome/Firefox/Edge)
				const player = new Hls()
				player.loadSource(hls)
				player.attachMedia(el)
				return () => player.destroy()
			}
		} else if (mp4) {
			el.src = mp4
		}
	})
</script>

<video bind:this={video} class={className} {poster} playsinline controls {...props}>
	<track kind="captions" />
</video>
