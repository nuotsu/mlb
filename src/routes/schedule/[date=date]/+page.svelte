<script lang="ts">
	import { count } from '$lib/utils'
	import DayPicker from '$ui/schedule/day-picker.svelte'
	import Game from '$ui/schedule/game.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const { totalGames, dates } = $derived(data.schedule)
</script>

<header class="p-ch text-center">
	<DayPicker />

	<p>
		{#if totalGames}
			{count(totalGames, 'game')}
		{:else}
			No games
		{/if}
	</p>
</header>

<section class="p-ch">
	{#each dates as date}
		<div class="columns-[450px] gap-lh space-y-ch *:break-inside-avoid">
			{#each date.games as game}
				<Game {game} />
			{/each}
		</div>
	{/each}
</section>
