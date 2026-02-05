<script lang="ts">
	import { page } from '$app/state'
	import { pushState } from '$app/navigation'
	import { formatDate } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Game from '$ui/game/game.svelte'
	import Metadata from '$ui/metadata.svelte'
	import DatePicker from '$ui/schedule/date-picker.svelte'
	import { fetchDaySchedule } from '../fetch'
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
		pushState(`/schedule/day/${date}`, {})
		schedule = await fetchDaySchedule(date)
	}

	const formattedDate = $derived(
		formatDate(currentDate + 'T00:00:00', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
		}),
	)
</script>

<Metadata title="{formattedDate} | MLB.TheOhtani.com" description="Game schedule for {formattedDate}" />

<header class="space-y-ch p-ch text-center">
	<DatePicker date={currentDate} {onDateChange} />

	{#if schedule.totalGames}
		<p>{count(schedule.totalGames, 'game')}</p>
	{/if}
</header>

<section class="p-ch max-sm:px-0">
	{#each schedule.dates as { games }}
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
