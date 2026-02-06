<script lang="ts">
	import { pushState } from '$app/navigation'
	import { page } from '$app/state'
	import { fetchDaySchedule } from '$lib/fetch'
	import { formatDate, slash } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import Game from '$ui/game/game.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import DatePicker from '$ui/schedule/date-picker.svelte'
	import SeasonProgress from '$ui/season/season-progress.svelte'
	import type { PageProps } from './$types'
	import { fetchSeasonProgress } from './fetch-season-progress'

	let { data }: PageProps = $props()

	let currentDate = $state(page.params.date!)
	let schedule = $derived(data.schedule)
	let seasonProgress = $derived(data.seasonProgress)

	$effect(() => {
		currentDate = page.params.date!
		schedule = data.schedule
		seasonProgress = data.seasonProgress
	})

	async function onDateChange(date: string) {
		currentDate = date
		pushState(`/schedule/day/${date}`, {})
		schedule = await fetchDaySchedule(date)
		seasonProgress = await fetchSeasonProgress(
			page.url.searchParams.get('sportId') || '1',
			new Date(slash(currentDate)).getFullYear().toString(),
			schedule,
		)
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

<Header
	title="Daily Schedule"
	crumbs={[
		{ href: `/schedule/week/${currentDate}`, name: 'Weekly Schedule' },
		{ href: `/schedule/day/${currentDate}`, name: formattedDate },
	]}
>
	{#snippet after()}
		<DatePicker date={currentDate} {onDateChange} />
	{/snippet}
</Header>

<section class="py-lh sm:px-ch">
	<SeasonProgress {currentDate} {seasonProgress} />

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
