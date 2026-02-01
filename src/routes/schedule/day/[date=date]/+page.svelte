<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Game from '$ui/game/game.svelte'
	import Metadata from '$ui/metadata.svelte'
	import DatePicker from '$ui/schedule/date-picker.svelte'
	import type { PageProps } from './$types'

	let { data, params }: PageProps = $props()

	const { totalGames, dates } = $derived(data.schedule)

	const date = $derived(
		formatDate(params.date + 'T00:00:00', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
		}),
	)
</script>

<Metadata title="{date} | MLB.TheOhtani.com" description="Game schedule for {date}" />

<header class="space-y-ch p-ch text-center">
	<DatePicker />

	{#if totalGames}
		<p>{count(totalGames, 'game')}</p>
	{/if}
</header>

<section class="p-ch max-sm:px-0">
	{#each dates as { games }}
		<div class="columns-[450px] gap-lh space-y-ch *:break-inside-avoid">
			{#each games as game (game.gamePk)}
				{@const { linescore } = game as MLB.Game & { linescore: MLB.Linescore }}
				<Game {game} {linescore} showDescription />
			{/each}
		</div>
	{:else}
		<div class="text-center">No games</div>
	{/each}
</section>
