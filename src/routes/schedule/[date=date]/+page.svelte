<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Game from '$ui/schedule/game.svelte'
	import type { PageProps } from './$types'

	let { params, data }: PageProps = $props()

	const { totalGames, dates } = $derived(data.schedule)
</script>

<header class="p-ch text-center">
	<h1>
		<small class="block leading-rlh">
			{formatDate(params.date + 'T00:00:00', {
				weekday: 'long',
			})}
		</small>

		{formatDate(params.date + 'T00:00:00', {
			month: 'long',
			day: 'numeric',
			year: 'numeric',
		})}
	</h1>

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
