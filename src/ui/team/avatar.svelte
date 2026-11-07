<script lang="ts">
	import { teamColor } from '#lib/team-colors.js'
	import { isNpbLogo, isTeamSpot, teamLogoSources } from '#lib/team-logos.js'
	import { cn } from '#lib/utils.js'

	let {
		teamId,
		class: className,
	}: {
		teamId: number
		/** Sets the size, e.g. `size-6` */
		class?: string
	} = $props()

	/** The on-dark cap, else npb.jp's logo, else the spot, as each fails to load */
	const sources = $derived(teamLogoSources(teamId, 'dark'))
	let attempt = $state(0)
	const src = $derived(sources[Math.min(attempt, sources.length - 1)])
</script>

<span
	class={cn('block shrink-0 rounded-full', className)}
	style:background-color={teamColor(teamId)}
>
	<img
		class={cn(
			'size-full rounded-full',
			isTeamSpot(src) ? 'object-cover' : 'object-contain',
			// Padding keeps a cap, or the corners of a square npb.jp logo, inside the circle
			isNpbLogo(src) ? 'bg-white p-[15%]' : !isTeamSpot(src) && 'p-[18%]',
		)}
		{src}
		alt=""
		width="72"
		height="72"
		draggable="false"
		onerror={() => {
			if (attempt < sources.length - 1) attempt++
		}}
	/>
</span>
