<script lang="ts">
	import type { HTMLVideoAttributes } from 'svelte/elements'
	import Hls from 'hls.js'

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
		if (!video || !hls) return

		if (video.canPlayType('application/vnd.apple.mpegurl')) {
			// Safari - native HLS
			video.src = hls
		} else if (Hls.isSupported()) {
			// Chrome/Firefox/Edge - use hls.js
			const player = new Hls()
			player.loadSource(hls)
			player.attachMedia(video)
			return () => player.destroy()
		}
	})
</script>

<video bind:this={video} class={className} {poster} controls {...props}>
	<source src={mp4} type="video/mp4" />
	<track kind="captions" />
</video>
