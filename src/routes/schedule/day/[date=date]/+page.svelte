<script lang="ts">
	import { pushState } from '$app/navigation'
	import { page } from '$app/state'
	import { fetchDaySchedule } from '$lib/fetch'
	import { formatDate, slash } from '$lib/temporal'
	import { count } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import { sortGames } from '$ui/favorites/store.svelte'
	import Game from '$ui/game/game.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import DatePicker from '$ui/schedule/date-picker.svelte'
	import SeasonProgress from '$ui/season/season-progress.svelte'
	import SelectSport from '$ui/select-sport.svelte'
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
		formatDate(slash(currentDate), {
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
		<div class="mx-auto flex flex-wrap items-center gap-ch text-center">
			<SelectSport class="button text-center" />
			<DatePicker date={currentDate} {onDateChange} class="mx-auto" />
		</div>
	{/snippet}
</Header>

<section class="flex min-h-[calc(100dvh-var(--header-height))] flex-col gap-ch">
	<div class="grow py-lh sm:px-ch">
		{#each schedule.dates as { games }}
			{#if schedule.totalGames}
				<p class="text-center text-current/50">{count(schedule.totalGames, 'game')}</p>
			{/if}
			<div class="columns-[450px] gap-lh space-y-ch *:break-inside-avoid">
				{#each games.sort(sortGames) as game (game.gamePk)}
					{@const { linescore } = game as MLB.Game & { linescore: MLB.Linescore }}
					<Game {game} {linescore} showDescription />
				{/each}
			</div>
		{:else}
			<Empty>No games</Empty>
		{/each}
	</div>

	{#if schedule.dates[0]?.games.some((game) => game.gameType === 'R')}
		<SeasonProgress {currentDate} {seasonProgress} />
	{/if}
</section>
