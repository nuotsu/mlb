<script lang="ts">
	import { roundName, type BracketSeries } from '$lib/postseason/bracket'
	import { cn } from '$lib/utils'
	import { spoilerPreventionStore } from '$ui/spoiler-prevention/store.svelte'
	import TeamAvatar from './team-avatar.svelte'

	let { series, spoiler = false }: { series: BracketSeries; spoiler?: boolean } = $props()

	const { top, bottom } = $derived(series)

	const showScore = $derived(!spoiler && (series.gamesPlayed > 0 || series.live))
	const scoreCenter = $derived((top.center + bottom.center) / 2)

	const title = $derived(
		[
			roundName(series.round, series.league),
			top.team && bottom.team && `${top.team.name} vs ${bottom.team.name}`,
			showScore && `${top.wins}-${bottom.wins}`,
		]
			.filter(Boolean)
			.join(' · '),
	)
</script>

<div class="relative" style:height="calc({series.height} * var(--unit))" {title}>
	<div class="absolute left-1/2 -translate-1/2" style:top="calc({top.center} * var(--unit))">
		<TeamAvatar team={top.team} />
	</div>

	<div class="absolute left-1/2 -translate-1/2" style:top="calc({bottom.center} * var(--unit))">
		<TeamAvatar team={bottom.team} />
	</div>

	{#if showScore}
		<div
			class={cn(
				'absolute left-1/2 flex -translate-1/2 items-center gap-[.5ch] text-xs font-medium tabular-nums',
				series.winner && 'text-accent',
			)}
			style:top="calc({scoreCenter} * var(--unit))"
		>
			<span>{top.wins}-{bottom.wins}</span>
			{#if series.live}
				<span class="size-1.5 animate-pulse rounded-full bg-accent" title="In progress"></span>
			{/if}
		</div>
	{/if}
</div>
