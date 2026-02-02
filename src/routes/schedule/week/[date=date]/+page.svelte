<script lang="ts">
	import { formatDate } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Game from '$ui/game/game.svelte'
	import Metadata from '$ui/metadata.svelte'
	import WeekPicker from '$ui/schedule/week-picker.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
</script>

<Metadata title="Weekly Schedule | MLB.TheOhtani.com" description="Weekly calendar of MLB games." />

<header class="p-ch">
	<WeekPicker />
</header>

<section class="space-y-px p-ch max-sm:px-0">
	{#each data.schedule.dates as date (date.date)}
		<details class="group accordion" open>
			<summary class="sticky top-0 z-1 flex items-center gap-ch py-ch backdrop-blur after:ml-0!">
				{formatDate(date.date + 'T00:00:00', {
					weekday: 'short',
					month: 'numeric',
					day: 'numeric',
				})}

				<a class="ml-auto link" href="/schedule/day/{date.date}">
					{count(date.games.length, 'game')}
				</a>
			</summary>

			<div class="columns-[450px] gap-lh space-y-ch *:break-inside-avoid">
				{#each date.games as game (game.gamePk)}
					{@const { linescore } = game as MLB.Game & { linescore: MLB.Linescore }}
					<Game {game} {linescore} showDescription />
				{/each}
			</div>
		</details>
	{:else}
		<div class="text-center">No games</div>
	{/each}
</section>
