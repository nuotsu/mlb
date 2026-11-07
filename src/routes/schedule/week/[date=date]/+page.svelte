<script lang="ts">
	import { fetchSeason, fetchWeekSchedule } from '#lib/fetch/presets.js'
	import type { NpbScheduleGame } from '#lib/npb-schedule.js'
	import { formatDate, getToday, slash } from '#lib/temporal.js'
	import { maintainSearchParams } from '#lib/url.svelte.js'
	import { count } from '#lib/utils.js'
	import Empty from '#ui/empty.svelte'
	import { sortFavorite } from '#ui/favorites/store.svelte.js'
	import Game from '#ui/game/game.svelte'
	import Header from '#ui/header.svelte'
	import Metadata from '#ui/metadata.svelte'
	import NpbScheduleGameCard from '#ui/npb-game/schedule-game.svelte'
	import SelectWeek from '#ui/schedule/select-week.svelte'
	import SeasonInfo from '#ui/season/season-info.svelte'
	import SelectSport from '#ui/select-sport.svelte'
	import ToggleAllDetails from '#ui/toggle-all-details.svelte'
	import { goto, invalidate } from '$app/navigation'
	import { page } from '$app/state'
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
	let currentDate: string = $state(page.params.date!)
	let schedule: MLB.ScheduleResponse = $derived(data.schedule)
	let season: MLB.SeasonDateInfo = $derived(data.season)

	const seriesRecords = $derived(
		(() => {
			const map = new Map<string, { homeWins: number; awayWins: number }>()

			for (const date of schedule.dates) {
				for (const g of date.games) {
					if (!g.gamesInSeries || g.gamesInSeries <= 1) continue
					if (g.status.abstractGameState !== 'Final') continue
					const key = `${g.teams.home.team.id}-${g.teams.away.team.id}`
					const rec = map.get(key) ?? { homeWins: 0, awayWins: 0 }
					const hs = g.teams.home.score ?? 0
					const as_ = g.teams.away.score ?? 0
					if (hs > as_) rec.homeWins++
					else if (as_ > hs) rec.awayWins++
					map.set(key, rec)
				}
			}
			return map
		})(),
	)

	$effect(() => {
		currentDate = page.params.date!
		schedule = data.schedule
		season = data.season
	})

	/** NPB's games by day, like the Stats API's `dates` */
	const npbDates = $derived.by(() => {
		if (!data.npb) return null
		const dates: { date: string; games: NpbScheduleGame[] }[] = []
		for (const game of data.npb) {
			if (dates.at(-1)?.date === game.date) dates.at(-1)!.games.push(game)
			else dates.push({ date: game.date, games: [game] })
		}
		return dates
	})

	const includestoday = $derived(
		(npbDates ?? schedule.dates).some((d) => d.date === getToday().toISOString().split('T')[0]),
	)

	$effect(() => {
		if (!includestoday) return

		const interval = setInterval(() => invalidate('schedule:week'), 1000 * 60 * 3) // 3 min

		return () => clearInterval(interval)
	})

	async function onDateChange(date: string) {
		// NPB's week loads from npb.jp, through the page's own load
		if (data.npb) return goto(maintainSearchParams(`/schedule/week/${date}`))

		currentDate = date
		schedule = await fetchWeekSchedule(date)
		season = await fetchSeason(new Date(slash(date)).getFullYear().toString())
		goto(`/schedule/week/${date}`, { shallow: true })
	}
</script>

<Metadata title="Weekly Schedule | MLB.TheOhtani.com" description="Weekly calendar of MLB games." />

<Header title="Weekly Schedule" crumbs={[{ name: 'Weekly Schedule', href: '/schedule/week' }]}>
	{#snippet after()}
		<div class="mx-auto flex flex-wrap items-center justify-center gap-ch text-center">
			<SelectSport available={data.availableSportIds} />
			<SelectWeek date={currentDate} onchange={onDateChange} />
			<ToggleAllDetails />
		</div>
	{/snippet}
</Header>

<section class="space-y-px py-lh sm:px-ch">
	{#each npbDates ?? schedule.dates as date (date.date)}
		{@render day(date)}
	{:else}
		<Empty>No games</Empty>
	{/each}

	{#if data.season}
		<hr class="my-lh border-dashed border-stroke" />
		<SeasonInfo {season} />
	{/if}
</section>

{#snippet day({ date, games }: { date: string; games: MLB.Game[] | NpbScheduleGame[] })}
	<details class="group accordion" open={formatDate(slash(date)) === formatDate(getToday())}>
		<summary class="sticky-below-header z-1 backdrop-blur-xs after:ml-0!">
			{formatDate(slash(date), {
				weekday: 'short',
				month: 'numeric',
				day: 'numeric',
			})}

			{#if formatDate(slash(date)) === formatDate(getToday())}
				<small class="dark:text-accent not-dark:positive">Today</small>
			{/if}

			<a class="ml-auto link" href={maintainSearchParams(`/schedule/day/${date}`)}>
				{count(games.length, 'game')}
			</a>
		</summary>

		<div
			class="grid anim-fade items-start gap-lh md:grid-cols-[repeat(auto-fill,minmax(var(--column-width,var(--container-xs)),1fr))] lg:[--column-width:var(--container-md)]"
		>
			{#if npbDates}
				{#each games as NpbScheduleGame[] as game (game.ref.code)}
					<NpbScheduleGameCard {game} />
				{/each}
			{:else}
				{#each (games as MLB.Game[]).sort(sortFavorite) as game (game.gamePk)}
					{@const { linescore } = game as MLB.Game & { linescore: MLB.Linescore }}

					<Game
						{game}
						{linescore}
						showDescription
						seriesRecord={seriesRecords.get(
							`${game.teams.home.team.id}-${game.teams.away.team.id}`,
						)}
					/>
				{/each}
			{/if}
		</div>
	</details>
{/snippet}
