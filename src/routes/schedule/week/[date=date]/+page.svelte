<script lang="ts">
	import { invalidate, pushState } from '$app/navigation'
	import { page } from '$app/state'
	import { fetchSeason, fetchWeekSchedule } from '$lib/fetch/presets'
	import { formatDate, getToday, slash } from '$lib/temporal'
	import { maintainSearchParams } from '$lib/url.svelte'
	import { count } from '$lib/utils'
	import Empty from '$ui/empty.svelte'
	import { sortFavorite } from '$ui/favorites/store.svelte'
	import Game from '$ui/game/game.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import SelectWeek from '$ui/schedule/select-week.svelte'
	import SeasonInfo from '$ui/season/season-info.svelte'
	import SelectSport from '$ui/select-sport.svelte'
	import ToggleAllDetails from '$ui/toggle-all-details.svelte'
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

	const includestoday = $derived(
		schedule.dates.some((d) => d.date === getToday().toISOString().split('T')[0]),
	)

	$effect(() => {
		if (!includestoday) return
		const interval = setInterval(() => invalidate('schedule:week'), 1000 * 60 * 3) // 3 min
		return () => clearInterval(interval)
	})

	async function onDateChange(date: string) {
		currentDate = date
		schedule = await fetchWeekSchedule(date)
		season = await fetchSeason(new Date(slash(date)).getFullYear().toString())
		pushState(`/schedule/week/${date}`, {})
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
	{#each schedule.dates as date (date.date)}
		<details class="group accordion" open={formatDate(slash(date.date)) === formatDate(getToday())}>
			<summary class="sticky-below-header z-1 backdrop-blur-xs after:ml-0!">
				{formatDate(slash(date.date), {
					weekday: 'short',
					month: 'numeric',
					day: 'numeric',
				})}

				{#if formatDate(slash(date.date)) === formatDate(getToday())}
					<small class="dark:text-accent not-dark:positive">Today</small>
				{/if}

				<a class="ml-auto link" href={maintainSearchParams(`/schedule/day/${date.date}`)}>
					{count(date.games.length, 'game')}
				</a>
			</summary>

			<div
				class="grid anim-fade items-start gap-lh md:grid-cols-[repeat(auto-fill,minmax(var(--column-width,var(--container-xs)),1fr))] lg:[--column-width:var(--container-md)]"
			>
				{#each date.games.sort(sortFavorite) as game (game.gamePk)}
					{@const { linescore } = game as MLB.Game & { linescore: MLB.Linescore }}
					<Game {game} {linescore} showDescription seriesRecord={seriesRecords.get(`${game.teams.home.team.id}-${game.teams.away.team.id}`)} />
				{/each}
			</div>
		</details>
	{:else}
		<Empty>No games</Empty>
	{/each}

	{#if data.season}
		<hr class="my-lh border-dashed border-stroke" />
		<SeasonInfo {season} />
	{/if}
</section>
