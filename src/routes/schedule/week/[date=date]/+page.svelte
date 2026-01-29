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

<section class="space-y-ch p-ch max-sm:px-0">
	{#each data.schedule.dates as date (date.date)}
		<details class="group" open>
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
		<div class="text-center">No games</div>
	{/each}
</section>

<style>
	details {
		summary::after {
			content: '▹';
			transition: rotate var(--default-transition-duration) ease-in-out;
		}

		&[open] summary::after {
			rotate: 90deg;
		}
	}
</style>
