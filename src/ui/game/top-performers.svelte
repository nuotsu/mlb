<script lang="ts">
	import Headshot from '$ui/player/headshot.svelte'

	let { feedLive }: { feedLive: MLB.LiveGameFeed } = $props()

	const topPerformers = $derived(feedLive.liveData.boxscore.topPerformers)
</script>

<dl>
	{#each topPerformers as { player, type }}
		{@const key = ['hitter', 'twoWayStarter'].includes(type)
			? 'batting'
			: ['starter', 'reliever'].includes(type)
				? 'pitching'
				: 'fielding'}
		{@const { summary } =
			(player.stats?.[key] as unknown as
				| MLB.BattingStats
				| MLB.PitchingStats
				| MLB.FieldingStats) ?? {}}

		{#if !['hitter', 'twoWayStarter', 'starter', 'reliever'].includes(type)}
			{console.warn(`Unhandled type: ${type}`)}
		{/if}

		<div class="group/player relative flex max-w-max items-center gap-ch">
			<dt class="shrink-0">
				<Headshot person={player.person} class="size-[1.5lh]" />
			</dt>

			<dd class="line-clamp-1 break-all" title={player.person.fullName}>
				<a class="decoration-dashed group-hover/player:underline" href="/player/{player.person.id}">
					{player.person.boxscoreName}

					<span class="absolute inset-0"></span>
				</a>
			</dd>

			{#if summary}
				<dd>{summary}</dd>
			{/if}
		</div>
	{/each}
</dl>
