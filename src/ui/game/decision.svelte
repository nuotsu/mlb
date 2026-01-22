<script lang="ts">
	import { fetchMLB } from '$lib/fetch'
	import Loading from '$ui/loading.svelte'

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

<dl>
	{#await fetchAllPlayers()}
		<Loading>Loading decisions...</Loading>
	{:then stats}
		{#each stats as stat, key}
			{@const [decision, { id }] = Object.entries(decisions)[key]}
			{@const player = feedLive.gameData.players[`ID${id}`] as unknown as MLB.Person}

			<div class="group/decision relative flex max-w-max items-center gap-ch">
				<dt class="grid shrink-0 items-center *:col-span-full *:row-span-full">
					<abbr
						class="relative mt-auto mr-auto grid aspect-square w-lh place-content-center text-[x-small] font-bold text-white"
						title={decision}
					>
						{decision.charAt(0).toUpperCase()}
					</abbr>

					<img
						class=" size-[1.5lh] object-contain"
						src="https://midfield.mlbstatic.com/v1/people/{id}/spots/48"
						alt={player.fullName}
						draggable={false}
					/>
				</dt>

				<dd class="line-clamp-1 break-all" title={player.fullName}>
					<a href="/player/{id}" class="decoration-dashed group-hover/decision:underline">
						{player.lastName}

						<span class="absolute inset-0"></span>
					</a>
				</dd>

				<dd>{stat.summary}</dd>
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
