<script lang="ts">
	import type { BracketTeam } from '#lib/postseason/bracket.js'
	import { teamColor } from '#lib/team-colors.js'
	import { isNpbLogo, isTeamSpot, teamLogoSources } from '#lib/team-logos.js'
	import { cn } from '#lib/utils.js'

	let {
		team,
		champion = false,
		leading = false,
		won = false,
		class: className,
	}: {
		team?: BracketTeam
		/** Won the World Series. */
		champion?: boolean
		/** Ahead in a series that is still being played. */
		leading?: boolean
		/** Won a completed series. */
		won?: boolean
		class?: string
	} = $props()

	/** The on-dark cap, else npb.jp's logo, else the spot, as each fails to load */
	const sources = $derived(team ? teamLogoSources(team.id, 'dark') : [])
	let attempt = $state(0)
	const src = $derived(sources[Math.min(attempt, sources.length - 1)] ?? '')

	// A new team in the same slot gets a fresh try at the cap logo.
	$effect(() => {
		void team?.id
		attempt = 0
	})

	// Only projected teams carry `clinched`; a real bracket never dims.
	const pending = $derived(team?.clinched === false)

	const label = $derived(
		!team
			? 'To be determined'
			: champion
				? `${team.name} (World Series champion)`
				: pending
					? `${team.name} (not yet clinched)`
					: team.name,
	)
</script>

{#if team}
	<a
		href="/teams/{team.id}"
		class={cn(
			'block size-(--avatar) shrink-0 rounded-full ring-2 ring-background transition-opacity hover:opacity-100',
			pending && 'opacity-40',
			leading && 'ring-green-400/50',
			won && 'ring-green-400',
			champion && 'ring-accent',
			className,
		)}
		style:background-color={teamColor(team.id)}
		title={label}
		aria-label={label}
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
	</a>
{:else}
	<div
		class={cn(
			'size-(--avatar) shrink-0 rounded-full border-2 border-dashed border-current/25',
			className,
		)}
		role="img"
		title="To be determined"
		aria-label="To be determined"
	></div>
{/if}
