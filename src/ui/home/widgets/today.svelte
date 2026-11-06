<script lang="ts">
	import { fetchLiveMLB } from '#lib/fetch/live.svelte.js'
	import { formatDate, getToday } from '#lib/temporal.js'
	import { favoritesStore, sortFavorite } from '#ui/favorites/store.svelte.js'
	import CountdownList from '#ui/season/countdown-list.svelte'
	import { browser } from '$app/env'
	import { untrack } from 'svelte'
	import Widget from '../widget.svelte'
	import type { WidgetData } from './index.js'
	import TodayGame from './today-game.svelte'

	let { data }: { data: WidgetData } = $props()

	const date = formatDate(getToday(), { locale: 'en-CA' })
	/** Live, then upcoming, then over */
	const STATE_ORDER: Record<string, number> = { Live: 0, Preview: 1, Final: 2 }

	// No MLB games in the offseason, so don't ask (the phase holds while the page is open).
	// Scores refresh every 30s, straight from the Stats API: plenty for a preview, free on the server.
	const offseason = untrack(() => data.phase === 'offseason')
	const schedule =
		browser && !offseason
			? fetchLiveMLB<MLB.ScheduleResponse>(
					'/api/v1/schedule',
					{
						sportId: '1',
						date,
						fields: [
							'dates,games,gamePk,gameDate',
							'status,abstractGameState,detailedState,reason',
							'teams,away,home,team,id,name,abbreviation,score,isWinner',
							'linescore,currentInning,inningState,scheduledInnings',
						],
						hydrate: 'team,linescore',
					},
					{ interval: 30_000 },
				)
			: undefined

	const loading = $derived(data.phase !== 'offseason' && !schedule?.data)
	const games = $derived(
		(schedule?.data?.dates?.[0]?.games ?? []).toSorted(
			(a, b) =>
				sortFavorite(a, b) ||
				(STATE_ORDER[a.status.abstractGameState] ?? 1) -
					(STATE_ORDER[b.status.abstractGameState] ?? 1) ||
				a.gameDate.localeCompare(b.gameDate),
		),
	)

	/** Spring Training or Opening Day is still ahead */
	const countdown = $derived(
		[data.season?.springStartDate, data.season?.regularSeasonStartDate].some(
			(d) => !!d && d > date,
		),
	)

	function isFavorite(game: MLB.Game) {
		return (
			favoritesStore.has(`/teams/${game.teams.away.team.id}`) ||
			favoritesStore.has(`/teams/${game.teams.home.team.id}`)
		)
	}
</script>

<Widget
	title={games.length || loading || !countdown ? "Today's games" : 'Countdown'}
	href="/schedule/day/{date}"
	linkLabel="Schedule"
>
	{#if loading}
		<ul class="games" aria-busy="true" aria-label="Loading today's games">
			{#each { length: 6 }, i (i)}
				<li class="h-[3.75lh] animate-pulse border border-stroke bg-current/5"></li>
			{/each}
		</ul>
	{:else if games.length}
		<ul class="games">
			{#each games as game (game.gamePk)}
				<TodayGame {game} favorite={isFavorite(game)} />
			{/each}
		</ul>
	{:else if !countdown}
		<p class="py-lh text-center text-sm text-current/60">No games today</p>
	{/if}

	{#if countdown && data.season && !loading}
		<div class={[games.length && 'mt-lh border-t border-dashed border-stroke pt-lh']}>
			<CountdownList season={data.season} />
		</div>
	{/if}
</Widget>

<style>
	.games {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
		gap: 1ch;
	}
</style>
