<script lang="ts">
	import { count } from '$lib/utils'
	import Game from '$ui/game/game.svelte'
	import DayPicker from '$ui/schedule/day-picker.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const { totalGames, dates } = $derived(data.schedule)
</script>

<header class="space-y-ch p-ch text-center">
	<DayPicker />

	{#if totalGames}
		<p>
			{count(totalGames, 'game')}
		</p>
	{/if}
</header>

<section class="p-ch">
	{#each dates as date}
		<div class="columns-[450px] gap-lh space-y-ch *:break-inside-avoid">
			{#each date.games as game}
				<Game {game} showDescription />
			{/each}
		</div>
	{:else}
		<div class="text-center">No games</div>
	{/each}
</section>
