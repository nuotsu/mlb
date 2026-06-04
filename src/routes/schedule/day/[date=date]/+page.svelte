<script lang="ts">
	import { invalidate, pushState } from '$app/navigation'
	import { page } from '$app/state'
	import { fetchDaySchedule, fetchSeason } from '$lib/fetch/presets'
	import { formatDate, getToday, slash } from '$lib/temporal'
	import { maintainSearchParams } from '$lib/url.svelte'
	import Divider from '$ui/divider.svelte'
	import Empty from '$ui/empty.svelte'
	import { sortFavorite } from '$ui/favorites/store.svelte'
	import Game from '$ui/game/game.svelte'
	import Header from '$ui/header.svelte'
	import Metadata from '$ui/metadata.svelte'
	import SelectDate from '$ui/schedule/select-date.svelte'
	import SeasonInfo from '$ui/season/season-info.svelte'
	import SeasonProgress from '$ui/season/season-progress.svelte'
	import SelectSport from '$ui/select-sport.svelte'
	import type { PageProps } from './$types'
	import { fetchSeasonProgress } from './fetch-season-progress'

	let { data }: PageProps = $props()

	let currentDate = $state(page.params.date!)
	let schedule = $derived(data.schedule)
	let seasonProgress = $derived(data.seasonProgress)
	let season: MLB.SeasonDateInfo = $derived(data.season)

	const seriesRecords = $derived(
		(() => {
			const map = new Map<string, { homeWins: number; awayWins: number }>()
			for (const date of (data.seriesContext?.dates ?? [])) {
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
		seasonProgress = data.seasonProgress
		season = data.season
	})

	const isToday = $derived(currentDate === getToday().toISOString().split('T')[0])

	$effect(() => {
		if (!isToday) return
		const interval = setInterval(() => invalidate('schedule:day'), 1000 * 60 * 3) // 3 min
		return () => clearInterval(interval)
	})

	async function onDateChange(date: string) {
		currentDate = date
		schedule = await fetchDaySchedule(date)
		seasonProgress = await fetchSeasonProgress(
			page.url.searchParams.get('sportId') || '1',
			new Date(slash(currentDate)).getFullYear().toString(),
			schedule,
		)
		season = await fetchSeason(new Date(slash(currentDate)).getFullYear().toString())
		pushState(`/schedule/day/${date}`, {})
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
		{ href: maintainSearchParams(`/schedule/week/${currentDate}`), name: formattedDate },
	]}
>
	{#snippet after()}
		<div class="mx-auto flex flex-wrap items-center justify-center gap-ch text-center">
			<SelectSport available={data.availableSportIds} />
			<SelectDate date={currentDate} onchange={onDateChange} />
		</div>
	{/snippet}
</Header>

<section class="py-lh sm:px-ch">
	{#if schedule.dates[0]?.games.some((game) => game.gameType === 'R')}
		<SeasonProgress class="mb-lh pt-lh max-sm:px-ch" {currentDate} {seasonProgress} />
	{/if}

	{#each schedule.dates as { games }}
		{@render groupedGames(games, 'Live')}
		{@render groupedGames(games, 'Preview')}
		{@render groupedGames(games, 'Final')}
	{:else}
		<Empty>No games</Empty>
	{/each}

	{#if data.season}
		<hr class="my-lh border-dashed border-stroke" />
		<SeasonInfo {season} />
	{/if}
</section>

{#snippet groupedGames(games: MLB.Game[], state: string)}
	{@const processedGames = games
		.filter((game) => game.status.abstractGameState === state)
		.sort(sortFavorite)}

	{#if processedGames.length}
		<Divider>
			{state} ({processedGames.length})
		</Divider>

		<div
			class="grid items-start gap-lh md:grid-cols-[repeat(auto-fill,minmax(var(--column-width,var(--container-xs)),1fr))] lg:[--column-width:var(--container-md)]"
		>
			{#each processedGames as game (game.gamePk)}
				{@const { linescore } = game as MLB.Game & { linescore: MLB.Linescore }}
				<Game {game} {linescore} showDescription showLiveDetails seriesRecord={seriesRecords.get(`${game.teams.home.team.id}-${game.teams.away.team.id}`)} />
			{/each}
		</div>
	{/if}
{/snippet}
