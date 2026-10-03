<script lang="ts">
	import { cn } from '#lib/utils.js'
	import { favoritesStore } from '$ui/favorites/store.svelte'
	import Headshot from '$ui/player/headshot.svelte'

	let { feedLive }: { feedLive: MLB.LiveGameFeed } = $props()

	const topPerformers = $derived(feedLive.liveData.boxscore.topPerformers)
</script>

<article class="max-w-max space-y-ch">
	<h2 class="text-xs text-current/40">Top Performers</h2>

	<dl class="grid gap-[.5ch]">
		{#each topPerformers as { player, type } (player.person.id)}
			{@const key = ['hitter', 'twoWayStarter'].includes(type)
				? 'batting'
				: ['starter', 'reliever'].includes(type)
					? 'pitching'
					: 'fielding'}
			{@const { summary } =
				(player.stats?.[key] as unknown as
					MLB.BattingStats | MLB.PitchingStats | MLB.FieldingStats) ?? {}}

			<div
				class={cn(
					'group/player relative flex items-center gap-ch',
					favoritesStore.has(`/player/${player.person.id}`) &&
						'bg-accent text-dark [box-shadow:-.25ch_0_0_var(--color-accent),.25ch_0_0_var(--color-accent)]',
				)}
			>
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
					<dd class="flex flex-wrap gap-x-[.5ch] leading-none tabular-nums">
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
