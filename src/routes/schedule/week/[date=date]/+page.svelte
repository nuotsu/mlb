<script lang="ts">
	import { pushState } from '$app/navigation'
	import { page } from '$app/state'
	import { formatDate, formatWeekRange } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import Game from '$ui/game/game.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import WeekPicker from '$ui/schedule/week-picker.svelte'
	import { fetchWeekSchedule } from '../fetch'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let currentDate: string = $state(page.params.date!)
	let schedule: MLB.ScheduleResponse = $state(data.schedule)

	// sync from load function on full navigation
	$effect(() => {
		currentDate = page.params.date!
		schedule = data.schedule
	})

	async function onDateChange(date: string) {
		currentDate = date
		pushState(`/schedule/week/${date}`, {})
		schedule = await fetchWeekSchedule(date)
	}
</script>

<Metadata title="Weekly Schedule | MLB.TheOhtani.com" description="Weekly calendar of MLB games." />

<Header title="Weekly Schedule" crumbs={[{ name: 'Weekly Schedule' }]}>
	{#snippet after()}
		<WeekPicker date={currentDate} {onDateChange} />
	{/snippet}
</Header>

<section class="space-y-px py-lh sm:px-ch">
	{#each schedule.dates as date (date.date)}
		<details class="group accordion" open>
			<summary class="sticky-below-header z-1 flex items-center gap-ch backdrop-blur after:ml-0!">
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
		<Empty>No games</Empty>
	{/each}
</section>
