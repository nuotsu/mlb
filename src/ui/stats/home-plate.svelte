<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements'

	const INITIAL_ORBIT = '0deg 80deg'

	let {
		class: className = '',
	}: {
		class?: string
	} & HTMLAttributes<HTMLElement> = $props()

	let viewer: HTMLElement | undefined = $state()
	let tiltedUp = $state(false)

	$effect(() => {
		import('@google/model-viewer')
	})

	$effect(() => {
		viewer?.addEventListener('camera-change', handleCameraChange)
		return () => viewer?.removeEventListener('camera-change', handleCameraChange)
	})

	function handleCameraChange() {
		const orbit = (viewer as any)?.getCameraOrbit()
		if (orbit) tiltedUp = orbit.phi > Math.PI / 2
	}

	function resetCamera() {
		if (viewer) {
			viewer.setAttribute('camera-orbit', INITIAL_ORBIT)
		}
	}
</script>

<figure class={className} class:z-1={tiltedUp}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<model-viewer
		class="h-[5lh] w-full"
		src="/models/home-plate.glb"
		alt="Home plate"
		orbit-sensitivity="0.05"
		camera-orbit={INITIAL_ORBIT}
		field-of-view="45deg"
		camera-controls
		disable-tap
		disable-zoom
		interaction-prompt="none"
		onpointerup={resetCamera}
		bind:this={viewer}
	></model-viewer>
</figure>
