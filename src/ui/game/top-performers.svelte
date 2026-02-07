<script lang="ts">
	import Headshot from '$ui/player/headshot.svelte'

	let { feedLive }: { feedLive: MLB.LiveGameFeed } = $props()

	const topPerformers = $derived(feedLive.liveData.boxscore.topPerformers)
</script>

<article class="space-y-ch">
	<h2 class="text-xs text-current/50">Top Performers</h2>

	<dl class="grid gap-[.5ch]">
		{#each topPerformers as { player, type } (player.person.id)}
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
				<dt class="flex shrink-0 items-center gap-ch self-start">
					<Headshot person={player.person} class="size-lh" />

					<a
						class="line-clamp-1 min-w-[10ch] break-all decoration-dashed group-hover/player:underline"
						href="/player/{player.person.id}"
						title={player.person.fullName}
					>
						{player.person.boxscoreName}

						<span class="absolute inset-0"></span>
					</a>
				</dt>

				{#if summary}
					{@const items = summary.split(', ')}
					<dd class="flex flex-wrap gap-x-[.5ch] leading-none">
						{#each items as item, i}
							<span>
								{item}{#if i < items.length - 1},{/if}
							</span>
						{/each}
					</dd>
				{/if}
			</div>
		{/each}
	</dl>
</article>
