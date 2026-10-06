<script lang="ts">
	import type { BracketTeam } from '#lib/postseason/bracket.js'
	import { teamColor } from '#lib/team-colors.js'
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

	let fallback = $state(false)

	// A new team in the same slot gets a fresh try at the cap logo.
	$effect(() => {
		void team?.id
		fallback = false
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
			class={cn('size-full rounded-full', fallback ? 'object-cover' : 'object-contain p-[18%]')}
			src={fallback
				? `https://midfield.mlbstatic.com/v1/team/${team.id}/spots/72`
				: `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${team.id}.svg`}
			alt=""
			width="72"
			height="72"
			draggable="false"
			onerror={() => {
				if (!fallback) fallback = true
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
