<script lang="ts">
	import { isNpbTeam, npbLogoUrl } from '#lib/npb-roster.js'
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

	/**
	 * Tried in order, moving on when one fails to load. The Stats API has caps for few NPB teams
	 * (the Giants and Tigers), and its generic ball for the rest, so those use npb.jp's logo
	 * (this year's, else last year's) before the ball.
	 */
	const sources = $derived.by(() => {
		const year = new Date().getFullYear()
		const npb = [npbLogoUrl(id, year), npbLogoUrl(id, year - 1)].filter((url) => url !== null)

		return [
			`https://www.mlbstatic.com/team-logos/team-cap-on-light/${id}.svg`,
			...npb,
			`https://midfield.mlbstatic.com/v1/team/${id}/spots/72`,
		]
	})

	/** NPB teams skip a custom (Stats API) dark source: it's the generic ball for most of them */
	const srcset = $derived(customSrcset && !isNpbTeam(id) ? customSrcset : darkCap)

	let attempt = $state(0)
	let srcsetValid = $state(false)

	$effect(() => {
		if (!srcset) return

		const img = new Image()
		img.src = srcset
		img.onload = () => (srcsetValid = true)
	})

	const src = $derived(sources[Math.min(attempt, sources.length - 1)])
	const isNpbLogo = $derived(src.startsWith('https://p.npb.jp/'))
</script>

<picture class="shrink-0">
	{#if srcsetValid}
		<source {srcset} media={colorSchemeStore.colorScheme === 'dark' ? undefined : '()'} />
	{/if}

	<img
		class={cn(
			'overflow-hidden text-transparent',
			className,
			// npb.jp's logos sit on white: a tile, rounded to read as a badge in dark mode
			isNpbLogo && 'rounded-[20%]',
		)}
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
