<script lang="ts">
	import { teamLogoSources, usesNpbLogo } from '#lib/team-logos.js'
	import { cn } from '#lib/utils.js'
	import { colorSchemeStore } from '#ui/store.svelte.js'
	import type { HTMLImgAttributes } from 'svelte/elements'

	let {
		team,
		srcset: customSrcset,
		class: className,
		...props
	}: {
		team: MLB.Team
		srcset?: string
		class?: string
	} & HTMLImgAttributes = $props()

	let { id, name } = $derived(team)

	const darkCap = $derived(`https://www.mlbstatic.com/team-logos/team-cap-on-dark/${id}.svg`)

	/** Tried in order, moving on when one fails to load (see `teamLogoSources`) */
	const sources = $derived(teamLogoSources(id))

	/**
	 * NPB teams (and their All-Star sides) show npb.jp's logo in both color schemes, so no dark
	 * cap or custom (Stats API) source replaces it
	 */
	const srcset = $derived(usesNpbLogo(id) ? undefined : customSrcset || darkCap)

	let attempt = $state(0)
	let srcsetValid = $state(false)

	$effect(() => {
		if (!srcset) return

		const img = new Image()
		img.src = srcset
		img.onload = () => (srcsetValid = true)
	})

	const src = $derived(sources[Math.min(attempt, sources.length - 1)])
</script>

<picture class="shrink-0">
	{#if srcsetValid}
		<source {srcset} media={colorSchemeStore.colorScheme === 'dark' ? undefined : '()'} />
	{/if}

	<img
		class={cn('overflow-hidden text-transparent', className)}
		{src}
		alt={name}
		width="300"
		height="300"
		draggable="false"
		onerror={() => {
			if (attempt < sources.length - 1) attempt++
		}}
		{...props}
	/>
</picture>
