<!--
	@component
	A KBO game on the schedule pages: the MLB game card, fed koreabaseball.com's schedule, the day's
	game list and the game's scoreboard in the Stats API's shapes, and linking to our KBO game page.
-->
<script lang="ts">
	import {
		toMlbScheduleFeed,
		toMlbScheduleGame,
		toMlbScheduleLinescore,
	} from '#lib/kbo-game-mlb.js'
	import { kboGamePath } from '#lib/kbo-game.js'
	import type { KboScheduleGame } from '#lib/kbo-schedule.js'
	import Game from '#ui/game/game.svelte'

	let { game }: { game: KboScheduleGame } = $props()

	const mlbGame = $derived(toMlbScheduleGame(game))
	const linescore = $derived(toMlbScheduleLinescore(game))
	/** The card shows this instead of polling the Stats API, which has no KBO games */
	const feed = $derived(toMlbScheduleFeed(mlbGame, linescore))
	const boxscore = $derived({
		teams: {
			away: { team: mlbGame.teams.away.team },
			home: { team: mlbGame.teams.home.team },
		},
	} as unknown as MLB.Boxscore)

	/** The day's game list names the starters, the day before and on the day */
	const starters = $derived(game.summary?.starters)
</script>

<Game
	game={mlbGame}
	{boxscore}
	{linescore}
	{feed}
	href={kboGamePath(game.id)}
	seriesRecord={game.series}
	showDescription
	{pregame}
/>

<!-- The probable starters, laid out like the MLB card's; koreabaseball.com gives just their names -->
{#snippet pregame()}
	{#if starters?.away || starters?.home}
		<div class="z-1 grid grid-cols-2 backdrop-blur-xs" style:grid-area="pregame" lang="ko">
			{#each [starters.away, starters.home] as pitcher, i (i)}
				<div>
					{#if pitcher}
						<span
							class="flex items-center justify-between gap-ch {i === 0
								? 'flex-row-reverse pl-ch'
								: 'pr-ch'}"
						>
							<span class="line-clamp-1 break-all">{pitcher.nameKo}</span>
						</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
{/snippet}
