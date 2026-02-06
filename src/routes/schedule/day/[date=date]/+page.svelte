<script lang="ts">
	import { pushState } from '$app/navigation'
	import { page } from '$app/state'
	import { formatDate } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import Game from '$ui/game/game.svelte'
	import Header from '$ui/header.svelte'
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

<Metadata
	title="{formattedDate} | MLB.TheOhtani.com"
	description="Game schedule for {formattedDate}"
/>

<Header title="Daily Schedule">
	{#snippet after()}
		<DatePicker date={currentDate} {onDateChange} />
	{/snippet}
</Header>

<section class="p-ch max-sm:px-0">
	{#each schedule.dates as { games }}
		{#if schedule.totalGames}
			<p>{count(schedule.totalGames, 'game')}</p>
		{/if}

		<div class="columns-[450px] gap-lh space-y-ch *:break-inside-avoid">
			{#each games as game (game.gamePk)}
				{@const { linescore } = game as MLB.Game & { linescore: MLB.Linescore }}
				<Game {game} {linescore} showDescription />
			{/each}
		</div>
	{:else}
		<Empty>No games</Empty>
	{/each}
</section>
