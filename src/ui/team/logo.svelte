<script lang="ts">
	import { isKboTeam, kboAllStarTeam } from '#lib/kbo.js'
	import { isNpbTeam } from '#lib/npb-roster.js'
	import { npbAllStarTeam } from '#lib/npb.js'
	import { teamLogoSources } from '#lib/team-logos.js'
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
	 * NPB's and KBO's All-Star sides have no Stats API team, and KBO teams no cap: no dark cap or
	 * custom source for them
	 */
	const noStatsApiLogo = $derived(!!npbAllStarTeam(id) || !!kboAllStarTeam(id) || isKboTeam(id))

	/** NPB teams skip a custom (Stats API) dark source: it's the generic ball for most of them */
	const srcset = $derived(
		noStatsApiLogo ? undefined : customSrcset && !isNpbTeam(id) ? customSrcset : darkCap,
	)

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
