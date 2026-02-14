<script lang="ts">
	import { pushState } from '$app/navigation'
	import { page } from '$app/state'
	import { fetchWeekSchedule } from '$lib/fetch'
	import { formatDate, slash } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import { sortGames } from '$ui/favorites/store.svelte'
	import Game from '$ui/game/game.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import WeekPicker from '$ui/schedule/week-picker.svelte'
	import SelectSport from '$ui/select-sport.svelte'
	import ToggleAllDetails from '$ui/toggle-all-details.svelte'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()

	let currentDate: string = $state(page.params.date!)
	let schedule: MLB.ScheduleResponse = $derived(data.schedule)

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

<Header title="Weekly Schedule" crumbs={[{ name: 'Weekly Schedule', href: '/schedule/week' }]}>
	{#snippet after()}
		<div class="mx-auto flex flex-wrap items-center gap-ch text-center">
			<SelectSport class="button text-center" />
			<WeekPicker date={currentDate} {onDateChange} />
			<ToggleAllDetails />
		</div>
	{/snippet}
</Header>

<section class="space-y-px py-lh sm:px-ch">
	{#each schedule.dates as date (date.date)}
		<details class="group accordion" open>
			<summary class="sticky-below-header z-1 backdrop-blur-xs after:ml-0!">
				{formatDate(slash(date.date), {
					weekday: 'short',
					month: 'numeric',
					day: 'numeric',
				})}

				<a class="ml-auto link" href="/schedule/day/{date.date}">
					{count(date.games.length, 'game')}
				</a>
			</summary>

			<div class="anim-fade columns-[450px] gap-lh space-y-ch *:break-inside-avoid">
				{#each date.games.sort(sortGames) as game (game.gamePk)}
					{@const { linescore } = game as MLB.Game & { linescore: MLB.Linescore }}
					<Game {game} {linescore} showDescription />
				{/each}
			</div>
		</details>
	{:else}
		<Empty>No games</Empty>
	{/each}
</section>
