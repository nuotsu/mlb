<script lang="ts">
	import { fetchMLB } from '$lib/fetch'
	import Loading from '$ui/loading.svelte'
	import Headshot from '$ui/player/headshot.svelte'

	let { feedLive }: { feedLive: MLB.LiveGameFeed } = $props()

	const decisions = $derived(feedLive.liveData.decisions ?? {})

	async function fetchPitcherStats(personId?: number) {
		const data = await fetchMLB<MLB.PlayerStatsResponse>(
			`/api/v1/people/${personId}/stats/game/${feedLive.gamePk}`,
		)

		return data.stats[0].splits.find((split) => split.group === 'pitching')
			?.stat as unknown as MLB.PitchingStats
	}

	async function fetchAllPlayers() {
		const ids = Object.values(decisions).map((player) => player.id)
		return await Promise.all(ids.map(fetchPitcherStats))
	}
</script>

<dl class="grid gap-[.5ch]">
	{#await fetchAllPlayers()}
		<Loading>Loading decisions...</Loading>
	{:then stats}
		{#each stats as { summary }, key}
			{@const [decision, { id }] = Object.entries(decisions)[key]}
			{@const player = feedLive.gameData.players[`ID${id}`] as unknown as MLB.Person}

			<div class="group/decision relative flex max-w-max items-center gap-ch">
				<dt class="flex shrink-0 items-center gap-ch self-start">
					<div class="relative flex items-center gap-ch">
						<abbr
							class="absolute bottom-0 left-0 grid aspect-square w-lh place-content-center text-[6px] font-bold text-white"
							title={decision}
						>
							{decision.charAt(0).toUpperCase()}
						</abbr>
						<Headshot person={player} class="size-lh" />
					</div>

					<a
						href="/player/{id}"
						class="line-clamp-1 min-w-[10ch] break-all decoration-dashed group-hover/decision:underline"
						title={player.fullName}
					>
						{player.lastName}
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
	{/await}
</dl>

<style>
	abbr {
		&[title='winner'] {
			background-color: var(--color-green-600);
		}
		&[title='loser'] {
			background-color: var(--color-red-600);
		}
		&[title='save'] {
			background-color: var(--color-blue-600);
		}
	}
</style>
