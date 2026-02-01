<script lang="ts">
	import { page } from '$app/state'
	import { formatDate } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Game from '$ui/game/game.svelte'
	import Metadata from '$ui/metadata.svelte'
	import { getWeekDates } from '$ui/schedule/store.svelte'
	import WeekPicker from '$ui/schedule/week-picker.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	const dateRange = $derived.by(() => {
		const { startDate, endDate } = getWeekDates(page.params.date)
		const start = formatDate(startDate, { month: 'short', day: 'numeric' })
		const end = formatDate(endDate, { month: 'short', day: 'numeric' })
		return `${start} - ${end}`
	})
</script>

<Metadata title="Weekly Schedule | MLB.TheOhtani.com" description="Weekly calendar of MLB games." />

<header class="p-ch">
	<WeekPicker />
</header>

<section class="space-y-ch p-ch max-sm:px-0">
	{#each data.schedule.dates as date (date.date)}
		<details class="accordion group" open>
			<summary class="flex items-center gap-ch px-ch">
				{formatDate(date.date + 'T00:00:00', {
					weekday: 'short',
					month: 'short',
					day: 'numeric',
				})}

				<a class="order-last link" href="/schedule/day/{date.date}">
					{count(date.games.length, 'game')}
				</a>
			</summary>

			<div class="mb-lh columns-[450px] gap-lh space-y-ch *:break-inside-avoid">
				{#each date.games as game (game.gamePk)}
					{@const { linescore } = game as MLB.Game & { linescore: MLB.Linescore }}
					<Game {game} {linescore} showDescription />
				{/each}
			</div>
		</details>
	{:else}
		<div class="text-center">No games for {dateRange}.</div>
	{/each}
</section>

